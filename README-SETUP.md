# Configuração do Chatbot com Evolution API

## 📋 Visão Geral

Este projeto usa **Baileys** (canal nativo do WhatsApp) através do Evolution API para criar um chatbot que coleta:
- 📍 Localização do usuário
- 📸 Foto do problema
- 📝 Descrição textual

## 🎯 Por que Baileys?

**Baileys** é a melhor escolha para seu caso porque:
- ✅ **Gratuito** - Não precisa de API oficial do WhatsApp Business
- ✅ **Multi-device** - Funciona com QR Code
- ✅ **Completo** - Suporta todos os tipos de mensagem (texto, imagem, localização, áudio, etc.)
- ✅ **Estável** - Protocolo nativo e maduro
- ✅ **Sem custos** - Ideal para MVP e testes

## 🚀 Passos para Configurar

### 1. Certifique-se que o Evolution API está rodando

```bash
docker-compose up -d
docker logs evolution_api
```

O Evolution API deve estar acessível em `http://localhost:8080`

### 2. Execute o script de configuração

```bash
./setup-instance.sh
```

Este script irá:
- Criar uma instância chamada "chatbot" com Baileys
- Configurar o webhook para `http://localhost:3000/webhook`
- Gerar um QR Code para você escanear

### 3. Conecte seu WhatsApp

Escaneie o QR Code gerado usando:
**WhatsApp > Configurações > Aparelhos Conectados > Conectar um Aparelho**

### 4. Inicie o chatbot

```bash
npm install
node chatbot.js
```

### 5. Teste o chatbot

Envie uma mensagem para o número do WhatsApp que você conectou!

## 🔧 Configuração Manual (alternativa)

Se preferir configurar manualmente via API:

### Criar Instância
```bash
curl -X POST "http://localhost:8080/instance/create" \
  -H "Content-Type: application/json" \
  -H "apikey: fcd76aa8-fb1b-48f6-887c-ca8fe566b079" \
  -d '{
    "instanceName": "chatbot",
    "integration": "WHATSAPP-BAILEYS",
    "qrcode": true
  }'
```

### Configurar Webhook
```bash
curl -X POST "http://localhost:8080/webhook/set/chatbot" \
  -H "Content-Type: application/json" \
  -H "apikey: fcd76aa8-fb1b-48f6-887c-ca8fe566b079" \
  -d '{
    "url": "http://localhost:3000/webhook",
    "webhook_by_events": false,
    "webhook_base64": false,
    "events": [
      "MESSAGES_UPSERT"
    ]
  }'
```

### Obter QR Code
```bash
curl -X GET "http://localhost:8080/instance/qrcode/chatbot" \
  -H "apikey: fcd76aa8-fb1b-48f6-887c-ca8fe566b079"
```

## 🔍 Comandos Úteis

### Verificar status da instância
```bash
curl -X GET "http://localhost:8080/instance/fetchInstances?instanceName=chatbot" \
  -H "apikey: fcd76aa8-fb1b-48f6-887c-ca8fe566b079" | jq '.'
```

### Ver informações de conexão
```bash
curl -X GET "http://localhost:8080/instance/connectionState/chatbot" \
  -H "apikey: fcd76aa8-fb1b-48f6-887c-ca8fe566b079" | jq '.'
```

### Desconectar instância
```bash
curl -X DELETE "http://localhost:8080/instance/logout/chatbot" \
  -H "apikey: fcd76aa8-fb1b-48f6-887c-ca8fe566b079"
```

### Deletar instância
```bash
curl -X DELETE "http://localhost:8080/instance/delete/chatbot" \
  -H "apikey: fcd76aa8-fb1b-48f6-887c-ca8fe566b079"
```

## 📱 Fluxo do Chatbot

1. **Usuário inicia conversa** → Bot pede localização
2. **Usuário envia localização** → Bot pede foto
3. **Usuário envia foto** (ou "pular") → Bot pede descrição
4. **Usuário envia descrição** → Bot salva dados e confirma

## 🛠️ Eventos do Webhook

O webhook recebe eventos no formato:

```json
{
  "event": "messages.upsert",
  "instance": "chatbot",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "message_id"
    },
    "message": {
      "conversation": "texto da mensagem",
      "locationMessage": {
        "degreesLatitude": -23.550520,
        "degreesLongitude": -46.633308
      },
      "imageMessage": {
        "url": "url_da_imagem",
        "mimetype": "image/jpeg"
      }
    }
  }
}
```

## ⚙️ Variáveis de Ambiente

As principais variáveis já configuradas no `.env`:

```env
# Evolution API
AUTHENTICATION_API_KEY=fcd76aa8-fb1b-48f6-887c-ca8fe566b079
SERVER_URL=http://localhost:8080

# Database
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://user:pass@postgis:5432/evolution

# Redis
CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://redis:6379
```

## 🔐 Segurança

⚠️ **IMPORTANTE**: Antes de colocar em produção:
- Altere a `AUTHENTICATION_API_KEY` para uma chave forte
- Use HTTPS (configure um reverse proxy com Nginx/Caddy)
- Configure firewall para proteger as portas
- Use variáveis de ambiente para senhas do banco

## 📚 Documentação Útil

- [Evolution API Docs](https://doc.evolution-api.com/)
- [Baileys Documentation](https://github.com/WhiskeySockets/Baileys)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)

## 🐛 Troubleshooting

### QR Code não aparece
- Verifique se o Evolution API está rodando: `docker logs evolution_api`
- Confirme que o Redis está conectado

### Webhook não recebe mensagens
- Verifique se o chatbot está rodando na porta 3000
- Confirme a URL do webhook: deve apontar para onde o chatbot está

### Instância desconecta frequentemente
- Use Baileys ao invés de API oficial
- Certifique-se de ter boa conexão de internet
- Não conecte o mesmo número em múltiplos lugares
