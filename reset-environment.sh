#!/bin/bash

echo "🔄 Resetando ambiente do chatbot..."
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Parar todos os containers
echo -e "${YELLOW}1. Parando containers...${NC}"
docker-compose down
echo ""

# 2. Remover volumes (opcional - descomente se quiser limpar dados do banco)
read -p "Deseja remover TODOS os dados (banco, redis, imagens)? (s/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo -e "${YELLOW}2. Removendo volumes...${NC}"
    docker-compose down -v

    # Limpar diretório de imagens
    if [ -d "./images" ]; then
        echo -e "${YELLOW}   Limpando diretório de imagens...${NC}"
        rm -rf ./images/*
    fi

    echo -e "${GREEN}✅ Volumes removidos${NC}"
else
    echo -e "${YELLOW}2. Mantendo volumes existentes${NC}"
fi
echo ""

# 3. Remover imagens Docker antigas do chatbot
echo -e "${YELLOW}3. Removendo imagens antigas do chatbot...${NC}"
docker rmi service-chatbot-api-chatbot 2>/dev/null || echo "   Nenhuma imagem antiga encontrada"
echo ""

# 4. Limpar cache do Docker build
echo -e "${YELLOW}4. Limpando cache do Docker...${NC}"
docker builder prune -f
echo ""

# 5. Recriar diretório de imagens
echo -e "${YELLOW}5. Recriando diretório de imagens...${NC}"
mkdir -p ./images
echo ""

# 6. Rebuild e start dos containers
echo -e "${YELLOW}6. Reconstruindo e iniciando containers...${NC}"
docker-compose up -d --build
echo ""

# 7. Aguardar containers iniciarem
echo -e "${YELLOW}7. Aguardando containers iniciarem...${NC}"
sleep 5
echo ""

# 8. Verificar status
echo -e "${YELLOW}8. Verificando status dos containers...${NC}"
docker-compose ps
echo ""

# 9. Verificar logs do Evolution API
echo -e "${YELLOW}9. Verificando logs do Evolution API...${NC}"
timeout 3 docker logs evolution_api --tail 10 2>/dev/null || true
echo ""

# 10. Verificar logs do Chatbot
echo -e "${YELLOW}10. Verificando logs do Chatbot...${NC}"
timeout 3 docker logs chatbot --tail 5 2>/dev/null || true
echo ""

echo -e "${GREEN}=====================================
✅ Ambiente resetado com sucesso!
=====================================${NC}"
echo ""
echo -e "${YELLOW}📋 Próximos passos:${NC}"
echo "1. Execute: ./get-qrcode.sh"
echo "2. Escaneie o QR Code"
echo "3. Teste enviando mensagem para o WhatsApp"
echo ""
echo -e "${YELLOW}🔍 Comandos úteis:${NC}"
echo "   docker-compose ps              # Ver status dos containers"
echo "   docker logs -f chatbot         # Ver logs do chatbot em tempo real"
echo "   docker logs -f evolution_api   # Ver logs do Evolution API"
echo "   docker-compose restart chatbot # Reiniciar apenas o chatbot"
echo ""
