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
  WAITING_SERVICE_CHOICE: 'waiting_service_choice',
  WAITING_CATEGORY: 'waiting_category',
  WAITING_LOCATION: 'waiting_location',
  WAITING_PHOTO: 'waiting_photo',
  WAITING_DESCRIPTION: 'waiting_description',
  WAITING_LOCATION_COLETA: 'waiting_location_coleta'
};

// Categorias de ocorrências
const CATEGORIES = {
  1: 'Coleta de lixo',
  2: 'Iluminação pública',
  3: 'Buraco na rua',
  4: 'Descarte de lixo incorreto',
  5: 'Alagamento',
  6: 'Elogio',
  7: 'Outros'
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
      const serviceMenu = '👋 Olá! Bem-vindo ao *Zeladoria Digital*!\n\n' +
        'Como posso te ajudar hoje?\n\n' +
        '1️⃣ Registrar uma ocorrência\n' +
        '2️⃣ Consultar dia da coleta de lixo\n\n' +
        'Digite *1* ou *2*:';

      await sendMessage(userId, serviceMenu);
      session.state = STATES.WAITING_SERVICE_CHOICE;
      break;

    case STATES.WAITING_SERVICE_CHOICE:
      const serviceChoice = parseInt(message.conversation || message.extendedTextMessage?.text);

      if (serviceChoice === 1) {
        // Fluxo de registrar ocorrência
        const categoryMenu = '*Escolha a categoria da ocorrência:*\n\n' +
          '1️⃣ Coleta de lixo\n' +
          '2️⃣ Iluminação pública\n' +
          '3️⃣ Buraco na rua\n' +
          '4️⃣ Descarte de lixo incorreto\n' +
          '5️⃣ Alagamento\n' +
          '6️⃣ Elogio\n' +
          '7️⃣ Outros\n\n' +
          'Digite o *número* da categoria:';

        await sendMessage(userId, categoryMenu);
        session.state = STATES.WAITING_CATEGORY;
      } else if (serviceChoice === 2) {
        // Fluxo de consultar dia de coleta
        await sendMessage(userId, '🗑️ *Consulta de Horário de Coleta*\n\nPor favor, envie sua *localização* (use o ícone 📎 > Localização)');
        session.state = STATES.WAITING_LOCATION_COLETA;
      } else {
        await sendMessage(userId, '❌ Opção inválida. Por favor, digite *1* para registrar ocorrência ou *2* para consultar coleta de lixo.');
      }
      break;

    case STATES.WAITING_CATEGORY:
      const categoryNumber = parseInt(message.conversation || message.extendedTextMessage?.text);

      if (categoryNumber >= 1 && categoryNumber <= 7) {
        session.data.category = categoryNumber;
        session.data.categoryName = CATEGORIES[categoryNumber];

        await sendMessage(userId, `✅ Categoria selecionada: *${CATEGORIES[categoryNumber]}*\n\nAgora, envie sua *localização* (use o ícone 📎 > Localização)`);
        session.state = STATES.WAITING_LOCATION;
      } else {
        await sendMessage(userId, '❌ Número inválido. Por favor, escolha um número de 1 a 7.');
      }
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

    case STATES.WAITING_LOCATION_COLETA:
      if (message.locationMessage) {
        const { degreesLatitude, degreesLongitude } = message.locationMessage;

        await sendMessage(userId, '🔄 Consultando horários de coleta...');

        // Consultar API de horários
        const horariosColeta = await consultarHorariosColeta(degreesLatitude, degreesLongitude);

        if (horariosColeta.success) {
          await enviarHorariosColeta(userId, horariosColeta);
        } else {
          await sendMessage(userId, `❌ ${horariosColeta.message}`);
        }

        // Limpa sessão
        delete sessions[userId];
      } else {
        await sendMessage(userId, '❌ Por favor, envie uma localização válida.');
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

// Consulta horários de coleta
async function consultarHorariosColeta(latitude, longitude) {
  try {
    console.log(`🔍 Consultando horários para: lat=${latitude}, lon=${longitude}`);

    const response = await axios.get('http://3.90.208.60:3080/api/v1/HorarioColeta/consultar', {
      params: {
        latitude: latitude,
        longitude: longitude
      }
    });

    console.log('✅ Horários encontrados:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao consultar horários:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', error.response.data);
      return error.response.data || { success: false, message: 'Erro ao consultar horários' };
    }
    return { success: false, message: 'Erro ao consultar horários' };
  }
}

// Formata e envia horários de coleta para o usuário
async function enviarHorariosColeta(userId, data) {
  const { bairro, horariosColeta } = data;

  let mensagem = `📍 *Bairro:* ${bairro.nome}\n`;
  mensagem += `📏 *Distância:* ${Math.round(bairro.distanciaMetros)}m\n\n`;
  mensagem += `🗑️ *Horários de Coleta:*\n\n`;

  if (horariosColeta && horariosColeta.length > 0) {
    horariosColeta.forEach(h => {
      mensagem += `📅 *${h.diaSemanaDescricao}*\n`;
      mensagem += `   ⏰ ${h.horario}\n`;
      mensagem += `   🌓 ${h.turno}\n`;
      if (h.nomeEmpresa) {
        mensagem += `   🏢 ${h.nomeEmpresa}\n`;
      }
      mensagem += '\n';
    });
  } else {
    mensagem += 'Nenhum horário de coleta encontrado para este bairro.\n';
  }

  mensagem += '✅ Lembre-se de colocar o lixo na calçada no dia e horário indicados!';

  await sendMessage(userId, mensagem);
}

// Envia para sua API final
async function sendToAPI(data) {
  console.log('📊 Dados recebidos para processar:');
  console.log('=====================================');
  console.log('📱 Telefone:', data.phone);
  console.log('🏷️  Categoria:', `${data.category} - ${data.categoryName}`);
  console.log('📍 Latitude:', data.latitude);
  console.log('📍 Longitude:', data.longitude);
  console.log('📸 Foto:', data.photo || 'Sem foto');
  console.log('📝 Descrição:', data.description);
  console.log('🕐 Timestamp:', new Date().toISOString());
  console.log('=====================================');

  try {
    // Extrair apenas números do telefone
    const phoneNumber = data.phone.replace(/\D/g, '');

    const payload = {
      telefone: phoneNumber,
      latitude: data.longitude, // API espera longitude no campo latitude
      longitude: data.latitude,  // API espera latitude no campo longitude
      descricao: data.description,
      fotoUrlPath: data.photo || 'sem_foto',
      categoria: data.category
    };

    console.log('📤 Enviando para API Zeladoria Digital...');
    console.log('Payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post('http://3.90.208.60:3080/api/v1/Ocorrencias', payload, {
      headers: {
        'accept': '*/*',
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Ocorrência registrada com sucesso!');
    console.log('Resposta da API:', JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error('❌ Erro ao enviar para API:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
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

// Endpoint para visualizar imagens por path completo ou filename
app.get('/image', (req, res) => {
  try {
    const { path: imagePath } = req.query;

    if (!imagePath) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro "path" é obrigatório. Exemplo: /image?path=/app/images/image_123.jpg'
      });
    }

    // Extrair apenas o nome do arquivo do path
    // Aceita tanto "/app/images/image_123.jpg" quanto "image_123.jpg"
    const filename = path.basename(imagePath);

    // Validar filename para evitar path traversal
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({
        success: false,
        error: 'Nome de arquivo inválido'
      });
    }

    const filepath = path.join(IMAGES_DIR, filename);

    // Verificar se o arquivo existe
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({
        success: false,
        error: 'Imagem não encontrada',
        searchedPath: filepath
      });
    }

    // Enviar a imagem
    res.sendFile(filepath);
  } catch (error) {
    console.error('❌ Erro ao buscar imagem:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para listar todas as imagens
app.get('/images', (_req, res) => {
  try {
    const files = fs.readdirSync(IMAGES_DIR);

    const images = files
      .filter(file => file.match(/\.(jpg|jpeg|png|gif)$/i))
      .map(file => ({
        filename: file,
        url: `/image?path=/app/images/${file}`,
        fullPath: `/app/images/${file}`,
        createdAt: fs.statSync(path.join(IMAGES_DIR, file)).mtime
      }))
      .sort((a, b) => b.createdAt - a.createdAt); // Mais recentes primeiro

    res.json({
      success: true,
      total: images.length,
      images: images
    });
  } catch (error) {
    console.error('❌ Erro ao listar imagens:', error.message);
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
  console.log('  POST /webhook                         - Recebe mensagens do WhatsApp');
  console.log('  POST /send-message                    - Envia mensagens (phone, message)');
  console.log('  GET  /images                          - Lista todas as imagens');
  console.log('  GET  /image?path=/app/images/xxx.jpg  - Visualiza imagem pelo path');
  console.log('  GET  /health                          - Health check');
});