#!/bin/bash

# Script para configurar a instância do Evolution API

EVOLUTION_URL="http://localhost:8080"
API_KEY="fcd76aa8-fb1b-48f6-887c-ca8fe566b079"
INSTANCE_NAME="chatbot"

echo "🚀 Configurando instância no Evolution API..."
echo ""

# 1. Criar a instância
echo "📱 Criando instância '$INSTANCE_NAME'..."
CREATE_RESPONSE=$(curl -s -X POST "$EVOLUTION_URL/instance/create" \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -d "{
    \"instanceName\": \"$INSTANCE_NAME\",
    \"integration\": \"WHATSAPP-BAILEYS\",
    \"qrcode\": true
  }")

echo "Resposta da criação:"
echo "$CREATE_RESPONSE" | jq '.'
echo ""

# 2. Configurar webhook
echo "🔗 Configurando webhook..."
WEBHOOK_RESPONSE=$(curl -s -X POST "$EVOLUTION_URL/webhook/set/$INSTANCE_NAME" \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -d '{
    "url": "http://localhost:3000/webhook",
    "webhook_by_events": false,
    "webhook_base64": false,
    "events": [
      "MESSAGES_UPSERT",
      "MESSAGES_UPDATE",
      "MESSAGES_DELETE",
      "SEND_MESSAGE",
      "CONNECTION_UPDATE"
    ]
  }')

echo "Resposta do webhook:"
echo "$WEBHOOK_RESPONSE" | jq '.'
echo ""

# 3. Conectar instância (gerar QR Code)
echo "📲 Gerando QR Code para conectar..."
CONNECT_RESPONSE=$(curl -s -X GET "$EVOLUTION_URL/instance/connect/$INSTANCE_NAME" \
  -H "apikey: $API_KEY")

echo "Resposta da conexão:"
echo "$CONNECT_RESPONSE" | jq '.'
echo ""

# 4. Obter QR Code
echo "📷 Obtendo QR Code..."
QR_RESPONSE=$(curl -s -X GET "$EVOLUTION_URL/instance/qrcode/$INSTANCE_NAME" \
  -H "apikey: $API_KEY")

echo "$QR_RESPONSE" | jq '.'
echo ""

echo "✅ Configuração concluída!"
echo ""
echo "📋 Próximos passos:"
echo "1. Escaneie o QR Code acima com seu WhatsApp (WhatsApp > Configurações > Aparelhos Conectados)"
echo "2. Inicie o chatbot: node chatbot.js"
echo "3. Envie uma mensagem para o número conectado para testar"
echo ""
echo "🔍 Para verificar o status da instância:"
echo "curl -X GET '$EVOLUTION_URL/instance/fetchInstances?instanceName=$INSTANCE_NAME' -H 'apikey: $API_KEY' | jq '.'"
