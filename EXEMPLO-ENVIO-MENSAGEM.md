# 📤 Como Enviar Mensagens de Lembrete

## Endpoint: POST /send-message

Use este endpoint para enviar mensagens de lembrete ou notificações para os usuários.

---

## 📋 Formato da Requisição

```json
{
  "phone": "5511999999999",
  "message": "Sua mensagem aqui"
}
```

### Campos:

- **phone** (string, obrigatório): Número do telefone
  - Aceita com ou sem `@s.whatsapp.net`
  - Exemplos válidos:
    - `"5511999999999"`
    - `"5511999999999@s.whatsapp.net"`

- **message** (string, obrigatório): Texto da mensagem
  - Suporta formatação do WhatsApp:
    - `*negrito*`
    - `_itálico_`
    - `~riscado~`
    - `` `monoespaçado` ``

---

## 🚀 Exemplos de Uso

### 1. cURL

```bash
curl -X POST http://localhost:3000/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5511999999999",
    "message": "🔔 Olá! Seu chamado #123 foi atualizado."
  }'
```

### 2. JavaScript/Node.js (axios)

```javascript
const axios = require('axios');

async function enviarLembrete(telefone, mensagem) {
  try {
    const response = await axios.post('http://localhost:3000/send-message', {
      phone: telefone,
      message: mensagem
    });

    console.log('✅ Mensagem enviada:', response.data);
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

// Exemplo de uso
enviarLembrete('5511999999999', '🔔 Lembrete: Seu chamado foi atualizado!');
```

### 3. Python (requests)

```python
import requests

def enviar_lembrete(telefone, mensagem):
    url = 'http://localhost:3000/send-message'
    payload = {
        'phone': telefone,
        'message': mensagem
    }

    response = requests.post(url, json=payload)

    if response.status_code == 200:
        print('✅ Mensagem enviada:', response.json())
    else:
        print('❌ Erro:', response.json())

# Exemplo de uso
enviar_lembrete('5511999999999', '🔔 Lembrete: Seu chamado foi atualizado!')
```

### 4. Usando Docker (dentro da rede Docker)

Se você tiver outro serviço no docker-compose que precisa enviar mensagens:

```yaml
# No seu docker-compose.yml
services:
  meu-servico:
    # ...
    depends_on:
      - chatbot
```

```javascript
// No código do seu serviço
const response = await axios.post('http://chatbot:3000/send-message', {
  phone: '5511999999999',
  message: 'Olá!'
});
```

---

## 📥 Respostas

### ✅ Sucesso (200)

```json
{
  "success": true,
  "message": "Mensagem enviada com sucesso",
  "to": "5511999999999@s.whatsapp.net"
}
```

### ❌ Erro - Campos faltando (400)

```json
{
  "success": false,
  "error": "Campos obrigatórios: phone e message"
}
```

### ❌ Erro - Falha no envio (500)

```json
{
  "success": false,
  "error": "Mensagem de erro detalhada"
}
```

---

## 🎯 Casos de Uso

### 1. Notificar atualização de chamado

```javascript
await axios.post('http://localhost:3000/send-message', {
  phone: '5511999999999',
  message: `🔔 *Atualização do Chamado #${chamadoId}*

Status: ${novoStatus}
Técnico: ${nomeTecnico}

Acesse: https://seu-site.com/chamado/${chamadoId}`
});
```

### 2. Lembrete de agendamento

```javascript
await axios.post('http://localhost:3000/send-message', {
  phone: userPhone,
  message: `⏰ *Lembrete*

Você tem um agendamento amanhã às ${horario}.

Local: ${endereco}
Serviço: ${servico}`
});
```

### 3. Confirmação de conclusão

```javascript
await axios.post('http://localhost:3000/send-message', {
  phone: userPhone,
  message: `✅ *Serviço Concluído*

Seu chamado #${id} foi finalizado com sucesso!

Obrigado por utilizar nossos serviços.`
});
```

---

## 🔐 Segurança (Recomendações para Produção)

Atualmente o endpoint está **sem autenticação**. Para produção, recomendo adicionar:

### 1. API Key no header

```javascript
// No chatbot.js, adicionar middleware de autenticação
app.post('/send-message', authenticateApiKey, async (req, res) => {
  // ... código existente
});

function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (apiKey !== process.env.CHATBOT_API_KEY) {
    return res.status(401).json({ error: 'API Key inválida' });
  }

  next();
}
```

### 2. Rate limiting

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10 // máximo 10 requisições por minuto
});

app.post('/send-message', limiter, async (req, res) => {
  // ... código existente
});
```

---

## 🧪 Testar o Endpoint

### Health Check

```bash
curl http://localhost:3000/health
```

Resposta:
```json
{
  "status": "ok",
  "timestamp": "2025-10-18T14:30:00.000Z",
  "service": "chatbot-api"
}
```

### Enviar mensagem de teste

```bash
curl -X POST http://localhost:3000/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "SEU_NUMERO_AQUI",
    "message": "🤖 Teste de envio de mensagem via API!"
  }'
```

---

## 📊 Integração com Banco de Dados

Exemplo de como buscar usuários do banco e enviar lembretes:

```javascript
// Exemplo com PostgreSQL
const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
  host: 'postgis',
  database: 'evolution',
  user: 'user',
  password: 'pass'
});

async function enviarLembretesAgendados() {
  // Buscar chamados que precisam de lembrete
  const result = await pool.query(`
    SELECT telefone, chamado_id, descricao
    FROM chamados
    WHERE status = 'pendente'
    AND lembrete_enviado = false
  `);

  for (const row of result.rows) {
    try {
      await axios.post('http://chatbot:3000/send-message', {
        phone: row.telefone,
        message: `🔔 Lembrete: Chamado #${row.chamado_id} está pendente.

Descrição: ${row.descricao}

Por favor, aguarde o atendimento.`
      });

      // Marcar lembrete como enviado
      await pool.query(
        'UPDATE chamados SET lembrete_enviado = true WHERE chamado_id = $1',
        [row.chamado_id]
      );

      console.log(`✅ Lembrete enviado para ${row.telefone}`);
    } catch (error) {
      console.error(`❌ Erro ao enviar para ${row.telefone}:`, error.message);
    }
  }
}

// Executar a cada 1 hora
setInterval(enviarLembretesAgendados, 60 * 60 * 1000);
```

---

## 🔍 Monitoramento

Ver logs em tempo real:

```bash
docker logs -f chatbot
```

Output esperado:
```
📤 Enviando mensagem para: 5511999999999@s.whatsapp.net
📝 Mensagem: 🔔 Seu chamado foi atualizado!
```
