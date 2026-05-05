# Lead Hub

Sistema separado, mas integrado ao formulário atual, para gestão de leads por vendedor e visão global do usuário master.

## O que este MVP entrega

- Recebimento de leads por API (`POST /api/public/leads`)
- Separação explícita por operadora
- Banco SQLite local
- Login com perfis `master` e `vendor`
- Vendedor enxerga apenas os leads dele
- Master enxerga todos os leads
- Atualização de status e observação interna
- Exportação para Excel (`.xlsx`) pelo master

## Stack

- Node.js
- Express
- SQLite (`better-sqlite3`)
- Sessão via cookie
- Exportação Excel com `exceljs`

## Subida local

1. Copie `.env.example` para `.env` e ajuste:

```env
PORT=4100
SESSION_SECRET=troque-esta-chave
LEAD_INGEST_TOKEN=troque-este-token
APP_BASE_URL=http://localhost:4100
```

2. Instale dependências:

```bash
npm install
```

3. Inicialize o banco e os usuários seed:

```bash
npm run bootstrap
```

4. Suba a aplicação:

```bash
npm run dev
```

## Usuários iniciais

Os usuários seed ficam em [seed-config.json](./seed-config.json). Ajuste e-mails e senhas antes de rodar o bootstrap em produção.

## Integração com o formulário atual

O formulário atual já sabe:

- nome
- telefone
- e-mail
- cidade
- data de nascimento
- número de vidas
- observações
- vendedor direcionado

Para integrar, o backend atual do formulário deve fazer um `POST` adicional para:

```http
POST /api/public/leads
X-Ingest-Token: SEU_TOKEN
Content-Type: application/json
```

Payload esperado:

```json
{
  "source": "formulario",
  "operadora": "bradesco",
  "externalId": "lead-123",
  "nome": "Cliente Teste",
  "telefone": "11999999999",
  "email": "cliente@email.com",
  "cidade": "Sao Paulo",
  "dataNascimento": "1993-08-21",
  "numeroVidas": "4",
  "cnpj": "nao",
  "observacoes": "Ligacao no periodo da tarde",
  "assignedSellerName": "Juliana Araujo"
}
```

Se `assignedSellerName` bater com o nome do vendedor seed, o lead entra vinculado automaticamente para esse vendedor.
Use `operadora` para separar Bradesco, Amil, SulAmérica e futuros formulários.

## Deploy com Docker

O projeto já está preparado para subir em `lead.abmix.tech` no mesmo proxy reverso usado pelos outros sistemas.

Arquivos:

- [Dockerfile](./Dockerfile)
- [docker-compose.yml](./docker-compose.yml)

Subida:

```bash
docker compose build
docker compose up -d
```

O `docker-compose.yml` já está configurado com:

- `VIRTUAL_HOST=lead.abmix.tech`
- `LETSENCRYPT_HOST=lead.abmix.tech`
- `VIRTUAL_PORT=4100`

Antes de produção, ajuste principalmente:

- `SESSION_SECRET`
- senhas do [seed-config.json](./seed-config.json)
- e-mails reais dos vendedores e do master

## Próximo passo natural

Depois de validar este projeto isolado, o próximo passo é ligar o `server.js` do formulário atual a este endpoint de ingestão, sem remover o WhatsApp nem o e-mail que já existem.
