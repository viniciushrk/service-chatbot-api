# 🧪 Guia de Testes do Chatbot

## ✅ Pré-requisitos

Antes de testar, confirme que tudo está rodando:

```bash
# 1. Verificar containers
docker ps

# Deve mostrar:
# - evolution_api (porta 8080)
# - postgis (porta 5432)
# - redis (porta 6379)

# 2. Verificar chatbot
# Em outro terminal, deve estar rodando:
node chatbot.js
# Deve mostrar: "Chatbot rodando na porta 3000"

# 3. Verificar status da instância
curl -X GET "http://localhost:8080/instance/fetchInstances" \
  -H "apikey: fcd76aa8-fb1b-48f6-887c-ca8fe566b079" | jq '.[] | select(.instance.instanceName == "chatbot") | .instance.status'

# Deve retornar: "open"
```

---

## 📱 TESTE 1: Fluxo Completo (Caminho Feliz)

### Passo 1: Inicie a conversa
1. **Pegue outro celular** (ou peça para alguém)
2. **Envie qualquer mensagem** para o número do WhatsApp conectado
3. **Exemplo**: "Olá" ou "Oi"

### ✅ Resultado Esperado:
```
👋 Olá! Vou coletar informações sobre o problema.

Por favor, envie sua *localização* (use o ícone 📎 > Localização)
```

---

### Passo 2: Envie uma localização
1. No WhatsApp, clique no ícone de **📎** (anexo)
2. Selecione **"Localização"**
3. Escolha qualquer lugar no mapa
4. Clique em **"Enviar localização selecionada"**

### ✅ Resultado Esperado:
```
📍 Localização recebida!

Agora envie uma *foto do local* (ou digite "pular" se não tiver foto)
```

### 🔍 Verificação no terminal do chatbot:
```javascript
// Você deve ver no console:
{
  state: 'waiting_photo',
  data: {
    latitude: -23.550520,
    longitude: -46.633308
  }
}
```

---

### Passo 3: Envie uma foto
1. Clique no ícone de **📎** (anexo)
2. Selecione **"Galeria"** ou tire uma foto
3. Envie qualquer imagem

### ✅ Resultado Esperado:
```
📸 Foto recebida!

Agora descreva o *problema* encontrado:
```

---

### Passo 4: Envie a descrição
Digite qualquer descrição de problema:

**Exemplo**: "Buraco na rua, muito grande e perigoso"

### ✅ Resultado Esperado:
```
✅ *Dados recebidos com sucesso!*

Obrigado pelo reporte. Sua solicitação foi registrada.
```

### 🔍 Verificação no terminal do chatbot:
```javascript
// Você deve ver no console:
Dados enviados: {
  latitude: -23.550520,
  longitude: -46.633308,
  photo_url: 'url_da_imagem_no_seu_storage',
  description: 'Buraco na rua, muito grande e perigoso',
  timestamp: '2025-10-18T14:30:00.000Z'
}
```

---

## 📱 TESTE 2: Pular Foto

### Repita os passos 1 e 2 acima

### Passo 3 (alternativo): Digite "pular"
Ao invés de enviar foto, digite: **pular**

### ✅ Resultado Esperado:
```
⏭️ Ok, sem foto.

Agora descreva o *problema* encontrado:
```

### Passo 4: Continue normalmente com a descrição

---

## 📱 TESTE 3: Mensagem Inválida

### Teste enviar mensagem de texto ao invés de localização

1. Inicie nova conversa
2. Quando bot pedir localização, envie **texto** ao invés
3. **Exemplo**: "Não sei enviar localização"

### ✅ Resultado Esperado:
```
❌ Por favor, envie uma localização válida.
```

---

## 📱 TESTE 4: Foto Inválida

1. Chegue até o passo de enviar foto
2. Envie **texto** ao invés de foto (e não digite "pular")
3. **Exemplo**: "Aqui está a foto" (mas sem anexar foto)

### ✅ Resultado Esperado:
```
❌ Envie uma foto ou digite "pular"
```

---

## 🐛 Troubleshooting

### ❌ Bot não responde nada

**Verificar:**
```bash
# 1. Chatbot está rodando?
# Terminal do chatbot deve mostrar requisições chegando

# 2. Webhook está configurado?
curl -X GET "http://localhost:8080/webhook/find/chatbot" \
  -H "apikey: fcd76aa8-fb1b-48f6-887c-ca8fe566b079" | jq '.'

# 3. Verificar logs do Evolution API
docker logs evolution_api --tail 50
```

**Solução:**
```bash
# Reconfigurar webhook
curl -X POST "http://localhost:8080/webhook/set/chatbot" \
  -H "Content-Type: application/json" \
  -H "apikey: fcd76aa8-fb1b-48f6-887c-ca8fe566b079" \
  -d '{
    "webhook": {
      "url": "http://localhost:3000/webhook",
      "webhook_by_events": false,
      "events": ["MESSAGES_UPSERT"]
    }
  }'
```

---

### ❌ Webhook recebe mensagens, mas bot não processa

**Verificar formato da mensagem:**

Adicione log no chatbot.js antes da linha 25:

```javascript
app.post('/webhook', async (req, res) => {
  console.log('📩 Webhook recebido:', JSON.stringify(req.body, null, 2));

  const { key, message } = req.body;
  // ...resto do código
```

**Problema comum:** A estrutura do webhook pode ser diferente. Verifique se está acessando os dados corretamente.

---

### ❌ Erro ao enviar mensagem de volta

**Verificar:**
```bash
# Testar envio manual
curl -X POST "http://localhost:8080/message/sendText/chatbot" \
  -H "Content-Type: application/json" \
  -H "apikey: fcd76aa8-fb1b-48f6-887c-ca8fe566b079" \
  -d '{
    "number": "5511999999999",
    "text": "Teste de mensagem"
  }'
```

---

### ❌ Foto não faz download

A função `downloadMedia` está mockada. Você precisa implementar:

```javascript
async function downloadMedia(imageMessage) {
  // Opção 1: Baixar via Evolution API
  const mediaUrl = imageMessage.url;

  // Opção 2: Usar o mediakey para baixar
  const response = await axios.get(
    `${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${INSTANCE_NAME}`,
    {
      headers: { 'apikey': API_KEY },
      data: { message: imageMessage }
    }
  );

  // Upload para seu storage (S3, Cloudinary, etc)
  // ...

  return 'url_final_da_imagem';
}
```

---

## 📊 Monitoramento

### Ver todas as mensagens sendo processadas

```bash
# Terminal 1: Evolution API logs
docker logs -f evolution_api

# Terminal 2: Chatbot logs
node chatbot.js

# Terminal 3: Testar requisições
curl -X GET "http://localhost:8080/instance/fetchInstances" \
  -H "apikey: fcd76aa8-fb1b-48f6-887c-ca8fe566b079" | jq '.'
```

---

## 🎯 Checklist Final

- [ ] Evolution API rodando (porta 8080)
- [ ] PostgreSQL/PostGIS rodando (porta 5432)
- [ ] Redis rodando (porta 6379)
- [ ] Instância "chatbot" com status "open"
- [ ] Webhook configurado para http://localhost:3000/webhook
- [ ] Chatbot rodando (porta 3000)
- [ ] QR Code escaneado e conectado
- [ ] Teste 1: Fluxo completo funcionando ✅
- [ ] Teste 2: Pular foto funcionando ✅
- [ ] Teste 3: Validação de localização ✅
- [ ] Teste 4: Validação de foto ✅

---

## 📝 Próximos Passos

Depois que tudo estiver funcionando:

1. **Implementar download de mídia real** (linha 118-122 do chatbot.js)
2. **Configurar storage** (S3, Cloudinary, etc) para fotos
3. **Implementar a API final** que vai receber os dados (linha 127 do chatbot.js)
4. **Adicionar tratamento de erros** mais robusto
5. **Adicionar logs** para debug
6. **Considerar usar banco de dados** ao invés de sessões em memória
7. **Adicionar timeout** para sessões inativas
8. **Testar múltiplos usuários** simultaneamente

---

## 🔥 Teste Rápido (One-liner)

Para testar se está tudo funcionando:

```bash
# Enviar mensagem de teste
curl -X POST "http://localhost:8080/message/sendText/chatbot" \
  -H "Content-Type: application/json" \
  -H "apikey: fcd76aa8-fb1b-48f6-887c-ca8fe566b079" \
  -d '{
    "number": "SEU_NUMERO_AQUI",
    "text": "🤖 Teste automatizado - O bot está funcionando!"
  }'
```

Troque `SEU_NUMERO_AQUI` pelo seu número no formato: `5511999999999`

---

**Boa sorte com os testes! 🚀**
