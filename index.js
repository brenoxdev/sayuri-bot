import 'dotenv/config';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { setupLeveling } from './modules/leveling.js';
import { setupRoles } from './modules/roles.js';
import { setupReactionRoles } from './modules/reaction-roles.js';
import { setupMusic } from './modules/music.js';
import { setupAIChat } from './modules/ai-chat.js';
import { setupVoiceAI } from './modules/voice-ai.js';
import { setupTikTokLive } from './modules/tiktok-live.js';
import { setupTTS } from './modules/tts.js';
import { setupBrain } from './modules/brain.js';
import { saveServerData } from './db/server-data.js';
import { setupFreeGames } from './modules/free-games.js';
import { setupWelcome } from './modules/welcome.js';
import { setupRAG } from './modules/rag-setup.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.once('ready', async () => {
  console.log(`✅ Bot online: ${client.user.tag}`);

  try {
    await saveServerData(client, process.env.GUILD_ID);
    console.log('✅ Dados do servidor carregados!');
  } catch (err) {
    console.error('❌ Erro ao carregar dados:', err.message);
  }
});

setupLeveling(client);
setupRoles(client);
setupReactionRoles(client);
setupFreeGames(client);
setupMusic(client);
setupAIChat(client);
setupVoiceAI(client);
setupTikTokLive(client);
setupTTS(client);
setupBrain(client);
setupWelcome(client);


client.login(process.env.DISCORD_TOKEN);