#!/bin/bash

EVOLUTION_URL="http://localhost:8080"
API_KEY="fcd76aa8-fb1b-48f6-887c-ca8fe566b079"
INSTANCE_NAME="chatbot"

echo "🔍 Verificando instância '$INSTANCE_NAME'..."
echo ""

# Buscar informações da instância
INSTANCE_INFO=$(curl -s -X GET "$EVOLUTION_URL/instance/fetchInstances" \
  -H "apikey: $API_KEY" | jq --arg name "$INSTANCE_NAME" '.[] | select(.instance.instanceName == $name)')

if [ -z "$INSTANCE_INFO" ]; then
  echo "❌ Instância '$INSTANCE_NAME' não encontrada!"
  echo ""
  echo "Criando nova instância..."

  CREATE_RESPONSE=$(curl -s -X POST "$EVOLUTION_URL/instance/create" \
    -H "Content-Type: application/json" \
    -H "apikey: $API_KEY" \
    -d "{
      \"instanceName\": \"$INSTANCE_NAME\",
      \"integration\": \"WHATSAPP-BAILEYS\",
      \"qrcode\": true,
      \"webhook\": {
        \"url\": \"http://chatbot:3000/webhook\",
        \"webhook_by_events\": false,
        \"webhook_base64\": false,
        \"events\": [
          \"MESSAGES_UPSERT\"
        ]
      }
    }")

  echo "$CREATE_RESPONSE" | jq '.'
  echo ""
  echo "⏳ Aguardando QR Code ser gerado (pode levar alguns segundos)..."
  sleep 5
fi

# Loop para obter QR Code
echo "📲 Buscando QR Code..."
echo ""

for i in {1..10}; do
  QR_INFO=$(curl -s -X GET "$EVOLUTION_URL/instance/fetchInstances" \
    -H "apikey: $API_KEY" | jq --arg name "$INSTANCE_NAME" '.[] | select(.instance.instanceName == $name)')

  QR_CODE=$(echo "$QR_INFO" | jq -r '.instance.qrcode.code // empty')
  STATUS=$(echo "$QR_INFO" | jq -r '.instance.status // empty')

  echo "Status: $STATUS"

  if [ "$STATUS" = "open" ]; then
    echo ""
    echo "✅ Instância já está conectada!"
    echo ""
    echo "Informações da conexão:"
    echo "$QR_INFO" | jq '{
      instanceName: .instance.instanceName,
      status: .instance.status,
      phone: .instance.profilePictureUrl
    }'
    exit 0
  fi

  if [ ! -z "$QR_CODE" ]; then
    echo ""
    echo "📷 QR Code encontrado!"
    echo ""
    echo "QR Code (base64):"
    echo "$QR_CODE"
    echo ""
    echo "QR Code (visual - para terminais com suporte):"
    echo "$QR_CODE" | sed 's/data:image\/png;base64,//' | base64 -d > /tmp/qrcode.png

    # Tenta exibir QR code no terminal se tiver qrencode instalado
    if command -v qrencode &> /dev/null; then
      echo "$QR_INFO" | jq -r '.instance.qrcode.code' | sed 's/data:image\/png;base64,//' | base64 -d | qrencode -t ansiutf8
    else
      echo "💡 Dica: Instale 'qrencode' para ver o QR Code no terminal"
      echo "   sudo apt install qrencode"
    fi

    echo ""
    echo "📱 Para escanear:"
    echo "1. Abra o WhatsApp no seu celular"
    echo "2. Vá em: Configurações > Aparelhos conectados > Conectar um aparelho"
    echo "3. Escaneie o QR Code acima"
    echo ""
    echo "💾 QR Code salvo em: /tmp/qrcode.png"
    echo "   Abra em um navegador: file:///tmp/qrcode.png"
    echo ""
    exit 0
  fi

  echo "Tentativa $i/10 - Aguardando QR Code..."
  sleep 3
done

echo ""
echo "❌ QR Code não foi gerado após 30 segundos"
echo ""
echo "Verifique os logs do Evolution API:"
echo "docker logs evolution_api --tail 50"
