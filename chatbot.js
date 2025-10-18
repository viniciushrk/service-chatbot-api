// chatbot.js
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Criar diretório para salvar imagens se não existir
const IMAGES_DIR = path.join(__dirname, 'images');
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Sessões dos usuários
const sessions = {};

const EVOLUTION_URL = process.env.EVOLUTION_URL || 'http://evolution-api:8080';
const API_KEY = process.env.API_KEY || 'fcd76aa8-fb1b-48f6-887c-ca8fe566b079';
const INSTANCE_NAME = process.env.INSTANCE_NAME || 'chatbot';

// Estados do fluxo
const STATES = {
  INIT: 'init',
  WAITING_LOCATION: 'waiting_location',
  WAITING_PHOTO: 'waiting_photo',
  WAITING_DESCRIPTION: 'waiting_description'
};

// Webhook recebe mensagens do WhatsApp
app.post('/webhook', async (req, res) => {
  try {
    console.log('📩 Webhook recebido:', JSON.stringify(req.body, null, 2));

    // Evolution API envia a estrutura no formato: { event, instance, data }
    const { event, data } = req.body;

    // Ignorar eventos que não são mensagens recebidas
    if (event !== 'messages.upsert') {
      return res.sendStatus(200);
    }

    // Verificar se tem dados da mensagem
    if (!data || !data.key || !data.message) {
      console.log('⚠️ Webhook sem dados válidos');
      return res.sendStatus(200);
    }

    const { key, message } = data;
    const userId = key.remoteJid;

    // Ignorar mensagens enviadas por nós mesmos
    if (key.fromMe) {
      return res.sendStatus(200);
    }

    await handleMessage(userId, message, key);
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

async function handleMessage(userId, message, key) {
  // Inicializa sessão
  if (!sessions[userId]) {
    sessions[userId] = {
      state: STATES.INIT,
      data: {}
    };
  }

  const session = sessions[userId];

  switch (session.state) {
    case STATES.INIT:
      await sendMessage(userId, '👋 Olá! Vou coletar informações sobre o problema.\n\nPor favor, envie sua *localização* (use o ícone 📎 > Localização)');
      session.state = STATES.WAITING_LOCATION;
      break;

    case STATES.WAITING_LOCATION:
      if (message.locationMessage) {
        const { degreesLatitude, degreesLongitude } = message.locationMessage;
        session.data.latitude = degreesLatitude;
        session.data.longitude = degreesLongitude;
        
        await sendMessage(userId, '📍 Localização recebida!\n\nAgora envie uma *foto do local* (ou digite "pular" se não tiver foto)');
        session.state = STATES.WAITING_PHOTO;
      } else {
        await sendMessage(userId, '❌ Por favor, envie uma localização válida.');
      }
      break;

    case STATES.WAITING_PHOTO:
      if (message.imageMessage) {
        // Download da imagem
        const imageUrl = await downloadMedia(message.imageMessage, key);
        session.data.photo = imageUrl;
        
        await sendMessage(userId, '📸 Foto recebida!\n\nAgora descreva o *problema* encontrado:');
        session.state = STATES.WAITING_DESCRIPTION;
      } else if (message.conversation?.toLowerCase() === 'pular') {
        session.data.photo = null;
        await sendMessage(userId, '⏭️ Ok, sem foto.\n\nAgora descreva o *problema* encontrado:');
        session.state = STATES.WAITING_DESCRIPTION;
      } else {
        await sendMessage(userId, '❌ Envie uma foto ou digite "pular"');
      }
      break;

    case STATES.WAITING_DESCRIPTION:
      if (message.conversation || message.extendedTextMessage) {
        const description = message.conversation || message.extendedTextMessage.text;
        session.data.description = description;
        session.data.phone = userId;

        // Envia dados para sua API
        await sendToAPI(session.data);

        await sendMessage(userId, '✅ *Dados recebidos com sucesso!*\n\nObrigado pelo reporte. Sua solicitação foi registrada.');

        // Limpa sessão
        delete sessions[userId];
      } else {
        await sendMessage(userId, '❌ Por favor, envie uma descrição em texto.');
      }
      break;
  }
}

// Envia mensagem via Evolution API
async function sendMessage(phone, text) {
  await axios.post(
    `${EVOLUTION_URL}/message/sendText/${INSTANCE_NAME}`,
    {
      number: phone,
      text: text
    },
    {
      headers: { 'apikey': API_KEY }
    }
  );
}

// Download de mídia
async function downloadMedia(imageMessage, key) {
  try {
    console.log('📥 Baixando imagem...');

    // Obter a imagem em base64 via Evolution API
    const response = await axios.post(
      `${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${INSTANCE_NAME}`,
      {
        message: {
          key: key,
          message: {
            imageMessage: imageMessage
          }
        }
      },
      {
        headers: { 'apikey': API_KEY }
      }
    );

    const base64Data = response.data.base64;

    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const filename = `image_${timestamp}.jpg`;
    const filepath = path.join(IMAGES_DIR, filename);

    // Remover o prefixo data:image/jpeg;base64, se existir
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');

    // Salvar imagem localmente
    fs.writeFileSync(filepath, base64Image, 'base64');

    console.log('✅ Imagem salva em:', filepath);

    return filepath;
  } catch (error) {
    console.error('❌ Erro ao baixar imagem:', error.message);
    console.error('Detalhes do erro:', error.response?.data || error);
    return null;
  }
}

// Envia para sua API final
async function sendToAPI(data) {
  console.log('📊 Dados recebidos para processar:');
  console.log('=====================================');
  console.log('📱 Telefone:', data.phone);
  console.log('📍 Latitude:', data.latitude);
  console.log('📍 Longitude:', data.longitude);
  console.log('📸 Foto:', data.photo || 'Sem foto');
  console.log('📝 Descrição:', data.description);
  console.log('🕐 Timestamp:', new Date().toISOString());
  console.log('=====================================');
}

// Endpoint genérico para enviar mensagens
app.post('/send-message', async (req, res) => {
  try {
    const { phone, message } = req.body;

    // Validação
    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: phone e message'
      });
    }

    // Normalizar telefone (aceita com ou sem @s.whatsapp.net)
    const normalizedPhone = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

    console.log(`📤 Enviando mensagem para: ${normalizedPhone}`);
    console.log(`📝 Mensagem: ${message}`);

    // Enviar mensagem via Evolution API
    await sendMessage(normalizedPhone, message);

    res.json({
      success: true,
      message: 'Mensagem enviada com sucesso',
      to: normalizedPhone
    });

  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint de health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'chatbot-api'
  });
});

app.listen(3000, () => {
  console.log('Chatbot rodando na porta 3000');
  console.log('');
  console.log('📋 Endpoints disponíveis:');
  console.log('  POST /webhook        - Recebe mensagens do WhatsApp');
  console.log('  POST /send-message   - Envia mensagens (phone, message)');
  console.log('  GET  /health         - Health check');
});