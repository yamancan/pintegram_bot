# 🤖 Pintegram

Pintegram is a lightweight Telegram bot that helps you save shared links from group chats directly into an Airtable table — making it easy to collect and access valuable resources discussed in Telegram groups.

It's designed for group use only, allowing users to quickly submit links with minimal interaction, optionally tagging them with structured fields like type or payment model via buttons.

> ⚠️ **Important Note**: The current codebase is structured around a specific Airtable schema (detailed below). To use this bot with your own Airtable base, you'll need to either:
> 1. Modify your Airtable structure to match the schema below, or
> 2. Modify the bot's code to match your Airtable structure
>
> The code and documentation provided here reflect the current implementation and schema.

## 🌟 Features

- **🔹 Group Chat Support**  
  Designed to work only inside Telegram groups — no private chats required.

- **🔹 Simple Link Submission**  
  Users can save links using a /savetool command or reply to a message with a link.

- **🔹 Button-Based Metadata Input**  
  After submitting a link, users can optionally select tool types, payment models, and other metadata through inline buttons.

- **🔹 Airtable Integration**
  - Automatically stores links and their metadata in a connected Airtable table
  - Makes it easy to browse and filter entries later
  - Requires no technical setup from end-users

- **🔹 Use Case: AI Tools Collection**  
  Initially built for curating AI tools, but can be reused for any purpose where link collection from group chats is useful (e.g., event links, job posts, news).

## 🚀 Getting Started

### Prerequisites

- A Telegram Bot Token (get it from [@BotFather](https://t.me/botfather))
- An Airtable account with API access
- Node.js ≥ 18

### Quick Setup

1. Clone and install:
```bash
git clone https://github.com/yamancan/pintegram.git
cd pintegram
npm install
```

2. Create `.env` file:
```env
BOT_TOKEN=your_telegram_bot_token
AIRTABLE_API_KEY=your_airtable_api_key
AIRTABLE_BASE_ID=your_airtable_base_id
```

3. Start the bot:
```bash
npm start
```

## 💡 Usage

### In Your Telegram Group

1. Add the bot to your group
2. Use `/savetool [name] [url] [description]` to save a tool
3. Optionally select metadata via buttons
4. Check your Airtable base for the saved entries

Example:
```
/savetool ChatGPT https://chat.openai.com "Advanced language model"
```

## 📊 Airtable Structure

### Pintegram Table Fields

| Field         | Type          | Description                    | Required |
|--------------|---------------|--------------------------------|----------|
| Name         | Text          | Tool name                      | Yes |
| URL          | URL           | Tool website/endpoint          | Yes |
| Description  | Long Text     | Brief tool description         | Yes |
| Types        | Multiple      | Tool categories                | Yes |
| State        | Single        | Tool status                    | Yes |
| API Services | Single        | API availability status        | Yes |
| isPaid       | Multiple      | Payment models                 | Yes |
| Created Time | DateTime      | Record creation timestamp      | Auto |
| Last Modified| DateTime      | Last update timestamp          | Auto |

### Field Options

#### Types (Multiple Select)
- Text to Image
- Text to Video
- Image to Image
- Image to Video
- Character to Image
- Character to Video
- Text to Sound
- Text to Speech
- Text to Music
- Image Helper
- Video Helper
- AI Aggregator
- Automation
- Undefined

#### State (Single Select)
- Public
- Beta
- Undefined

#### API Services (Single Select)
- Fully
- Partially
- Unofficial
- Not Provided

#### isPaid (Multiple Select)
- Pay as you Go
- Monthly
- Freemium
- Open Source

## 📝 Contributing

1. Fork the repo
2. Create a branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Push and open a pull request

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- [grammY](https://grammy.dev/) — Telegram bot framework  
- [Airtable](https://airtable.com/) — Flexible backend and low-code DB 