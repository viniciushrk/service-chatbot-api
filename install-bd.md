# Instalar Docker
sudo dnf install -y docker
sudo systemctl start docker
sudo systemctl enable docker

# Rodar PostgreSQL 15 + PostGIS completo
sudo docker run -d \
  --name postgres-postgis \
  -e POSTGRES_PASSWORD=suasenha123 \
  -e POSTGRES_DB=zelador_db \
  -p 5432:5432 \
  --restart unless-stopped \
  postgis/postgis:15-3.4

# Verificar se está rodando
sudo docker ps

# Testar conexão
sudo docker exec -it postgres-postgis psql -U postgres -d zelador_db -c "SELECT PostGIS_version();"



}
📊 Dados recebidos para processar:
=====================================
📱 Telefone: 556992555454@s.whatsapp.net
📍 Latitude: -8.7447876
📍 Longitude: -63.871264
📸 Foto: /app/images/image_1760820539959.jpg
📝 Descrição: Este homem é muito bonito e me causa problemas
🕐 Timestamp: 2025-10-18T20:49:13.489Z