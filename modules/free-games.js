import fetch from 'node-fetch';
import fs from 'fs';
import { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js';

const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // ← Muda para 24 HORAS
const PANEL_FILE = 'db/free-games-panel.json';
const NOTIFIED_FILE = 'db/free-games-notified.json'; // ← Novo arquivo

let cachedGames = [];

// ==================== PERSISTÊNCIA DO NOTIFIED ====================
function loadNotified() {
  try {
    if (fs.existsSync(NOTIFIED_FILE)) {
      const data = JSON.parse(fs.readFileSync(NOTIFIED_FILE, 'utf8'));
      return new Set(data.games || []);
    }
  } catch {}
  return new Set();
}

function saveNotified(notifiedSet) {
  try {
    fs.mkdirSync('db', { recursive: true });
    fs.writeFileSync(NOTIFIED_FILE, JSON.stringify({
      games: Array.from(notifiedSet),
      updatedAt: new Date().toISOString()
    }, null, 2));
  } catch (err) {
    console.error('[FreeGames] Erro ao salvar notified:', err.message);
  }
}

// Carrega do disco ao iniciar
const notifiedGames = loadNotified();

function loadPanel() {
  try {
    if (fs.existsSync(PANEL_FILE)) {
      return JSON.parse(fs.readFileSync(PANEL_FILE, 'utf8'));
    }
  } catch {}
  return { messageId: null, channelId: null };
}

function savePanel(messageId, channelId) {
  try {
    fs.mkdirSync('db', { recursive: true });
    fs.writeFileSync(PANEL_FILE, JSON.stringify({ messageId, channelId }, null, 2));
  } catch (err) {
    console.error('[FreeGames] Erro ao salvar painel:', err.message);
  }
}

// ==================== EPIC GAMES ====================
async function getEpicFreeGames() {
  try {
    const response = await fetch(
      'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=pt-BR&country=BR&allowCountries=BR'
    );
    const data = await response.json();
    const games = data?.data?.Catalog?.searchStore?.elements ?? [];

    return games
      .filter(game => {
        const promotions = game.promotions?.promotionalOffers?.[0]?.promotionalOffers ?? [];
        const isFree = game.price?.totalPrice?.discountPrice === 0;
        const hasPromo = promotions.length > 0;
        return isFree && hasPromo;
      })
      .map(game => {
        const slug =
          game.catalogNs?.mappings?.[0]?.pageSlug ||
          game.offerMappings?.[0]?.pageSlug ||
          game.productSlug ||
          game.urlSlug;

        const cleanSlug = slug
          ?.replace('/home', '')
          ?.replace(/\/[a-f0-9]{32}/i, '')
          ?.trim();

        const url = cleanSlug && !cleanSlug.match(/^[a-f0-9]{32}$/i)
          ? `https://store.epicgames.com/pt-BR/p/${cleanSlug}`
          : `https://store.epicgames.com/pt-BR/free-games`;

        return {
          title: game.title,
          description: game.description?.slice(0, 200) || 'Jogo gratuito por tempo limitado!',
          image: game.keyImages?.find(img => img.type === 'Thumbnail')?.url || game.keyImages?.[0]?.url || '',
          url,
          endDate: game.promotions?.promotionalOffers?.[0]?.promotionalOffers?.[0]?.endDate,
          store: 'Epic Games',
          color: '#2d2d2d',
          emoji: '🎮'
        };
      });
  } catch (err) {
    console.error('[FreeGames] Erro Epic Games:', err.message);
    return [];
  }
}

// ==================== GOG ====================
async function getGOGFreeGames() {
  try {
    const response = await fetch(
      'https://www.gog.com/games/ajax/filtered?mediaType=game&price=free&page=1'
    );
    const data = await response.json();

    return (data?.products ?? [])
      .filter(game => game.price?.isFree)
      .map(game => ({
        title: game.title,
        description: 'Jogo gratuito na GOG!',
        image: `https:${game.image}.jpg`,
        url: `https://www.gog.com${game.url}`,
        endDate: null,
        store: 'GOG',
        color: '#8A2BE2',
        emoji: '🟣'
      }));
  } catch (err) {
    console.error('[FreeGames] Erro GOG:', err.message);
    return [];
  }
}

// ==================== STEAM ====================
async function getSteamFreeGames() {
  try {
    const response = await fetch(
      'https://store.steampowered.com/api/featuredcategories?cc=BR&l=portuguese'
    );
    const data = await response.json();
    const specials = data?.specials?.items ?? [];

    return specials
      .filter(game => game.discounted && game.final_price === 0)
      .map(game => ({
        title: game.name,
        description: 'Jogo gratuito na Steam!',
        image: game.header_image || game.large_capsule_image || '',
        url: `https://store.steampowered.com/app/${game.id}`,
        endDate: game.discount_expiration
          ? new Date(game.discount_expiration * 1000).toISOString()
          : null,
        store: 'Steam',
        color: '#1b2838',
        emoji: '💨'
      }));
  } catch (err) {
    console.error('[FreeGames] Erro Steam:', err.message);
    return [];
  }
}

// ==================== EMBEDS ====================
function createGameEmbed(game) {
  const embed = new EmbedBuilder()
    .setColor(game.color || '#9B59B6')
    .setTitle(`${game.emoji} ${game.title} — GRÁTIS!`)
    .setDescription(game.description || 'Corre lá pegar antes que acabe!')
    .setURL(game.url)
    .addFields(
      { name: '🏪 Loja', value: game.store, inline: true },
      { name: '💰 Preço', value: '**GRÁTIS**', inline: true }
    );

  if (game.endDate) {
    const end = new Date(game.endDate);
    embed.addFields({
      name: '⏰ Disponível até',
      value: end.toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }),
      inline: true
    });
  }

  if (game.image) embed.setThumbnail(game.image);
  embed.setFooter({ text: 'Corre lá resgatar! É de graça 🎉' });
  embed.setTimestamp();

  return embed;
}

function createListEmbed(games) {
  const embed = new EmbedBuilder()
    .setColor('#9B59B6')
    .setTitle('🎮 Jogos Gratuitos Disponíveis Agora!')
    .setDescription('Selecione um jogo no menu abaixo para ver detalhes e acessar o link de resgate!')
    .setTimestamp()
    .setFooter({ text: `${games.length} jogo(s) gratuito(s) • Atualizado agora` });

  const byStore = {};
  for (const game of games) {
    if (!byStore[game.store]) byStore[game.store] = [];
    byStore[game.store].push(game);
  }

  for (const [store, storeGames] of Object.entries(byStore)) {
    const storeEmoji = storeGames[0]?.emoji || '🎮';
    embed.addFields({
      name: `${storeEmoji} ${store}`,
      value: storeGames.map(g => `• **${g.title}**`).join('\n'),
      inline: false
    });
  }

  return embed;
}

function createSelectMenu(games) {
  const options = games.slice(0, 25).map((game, index) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(game.title.substring(0, 100))
      .setValue(`game_${index}`)
      .setDescription(`${game.store} — Clique para ver o link`)
      .setEmoji(game.emoji)
  );

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('free_game_select')
    .setPlaceholder('🎮 Selecione um jogo para resgatar...')
    .addOptions(options);

  return new ActionRowBuilder().addComponents(selectMenu);
}

function createRefreshButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('free_games_refresh')
      .setLabel('🔄 Atualizar Lista')
      .setStyle(ButtonStyle.Secondary)
  );
}

// ==================== PAINEL ÚNICO ====================
async function sendOrUpdatePanel(client, games, isNew = false) {
  const gamesChannel = client.channels.cache.get(process.env.FREE_GAMES_CHANNEL_ID);
  if (!gamesChannel) return;

  const embed = createListEmbed(games);
  const selectMenu = createSelectMenu(games);
  const refreshButton = createRefreshButton();

  const panel = loadPanel();

  // Tenta editar a mensagem existente
  if (panel.messageId && panel.channelId === process.env.FREE_GAMES_CHANNEL_ID) {
    try {
      const existingMsg = await gamesChannel.messages.fetch(panel.messageId);
      
      await existingMsg.edit({
        content: '🎮 **Jogos gratuitos disponíveis!** Selecione abaixo para resgatar:',
        embeds: [embed],
        components: [selectMenu, refreshButton]
      });

      console.log('[FreeGames] ✅ Painel atualizado (mensagem existente editada)');
      return;
    } catch (err) {
      console.log('[FreeGames] Mensagem antiga não encontrada, criando nova...');
    }
  }

  // Cria nova mensagem se não existir
  const msg = await gamesChannel.send({
    content: '@everyone 🎮 **Jogos gratuitos disponíveis!** Selecione abaixo para resgatar:',
    embeds: [embed],
    components: [selectMenu, refreshButton]
  });

  // Salva ID da nova mensagem
  savePanel(msg.id, process.env.FREE_GAMES_CHANNEL_ID);
  console.log('[FreeGames] ✅ Novo painel criado e ID salvo');
}

// ==================== CHECK E NOTIFICAR ====================
async function checkAndNotify(client) {
  console.log('[FreeGames] Verificando jogos gratuitos...');

  const mainChannel = client.channels.cache.get(process.env.MAIN_CHANNEL_ID);

  const [epicGames, gogGames, steamGames] = await Promise.all([
    getEpicFreeGames(),
    getGOGFreeGames(),
    getSteamFreeGames(),
  ]);

  const allGames = [...epicGames, ...gogGames, ...steamGames];
  cachedGames = allGames;

  if (allGames.length === 0) {
    console.log('[FreeGames] Nenhum jogo gratuito encontrado');
    return;
  }

  // Filtra jogos novos
  const newGames = allGames.filter(game => {
    const key = `${game.store}-${game.title}`;
    return !notifiedGames.has(key);
  });

  // Sempre atualiza o painel silenciosamente
  await sendOrUpdatePanel(client, allGames);

  // Só avisa no main se tiver jogo NOVO
  if (newGames.length > 0 && mainChannel) {
    // Adiciona ao set e salva no disco
    newGames.forEach(game => {
      notifiedGames.add(`${game.store}-${game.title}`);
    });
    saveNotified(notifiedGames); // ← Salva para persistir entre restarts

    const gamesList = newGames.map(g => `**${g.title}** (${g.store})`).join(', ');
    await mainChannel.send(
      `🎮 Ei pessoal! ${newGames.length > 1 ? 'Jogos novos' : 'Jogo novo'} de graça: ${gamesList}! Confere no canal <#${process.env.FREE_GAMES_CHANNEL_ID}> 🔥`
    );
    console.log(`[FreeGames] ✅ ${newGames.length} jogo(s) novo(s) notificado(s)!`);
  } else {
    console.log('[FreeGames] Nenhum jogo novo, painel atualizado silenciosamente');
  }
}

// ==================== INTERAÇÕES ====================
export function setupFreeGamesInteractions(client) {
  client.on('interactionCreate', async (interaction) => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'free_game_select') {
      const index = parseInt(interaction.values[0].replace('game_', ''));
      const game = cachedGames[index];

      if (!game) {
        return interaction.reply({ content: '❌ Jogo não encontrado!', ephemeral: true });
      }

      const embed = createGameEmbed(game);
      const button = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel(`🎮 Resgatar ${game.title}`)
          .setURL(game.url)
          .setStyle(ButtonStyle.Link)
      );

      await interaction.reply({
        content: `Aqui estão os detalhes de **${game.title}**! Clica no botão pra resgatar 🎉`,
        embeds: [embed],
        components: [button],
        ephemeral: true
      });
    }

    if (interaction.isButton() && interaction.customId === 'free_games_refresh') {
      await interaction.deferReply({ ephemeral: true });

      const [epicGames, gogGames, steamGames] = await Promise.all([
        getEpicFreeGames(),
        getGOGFreeGames(),
        getSteamFreeGames(),
      ]);

      cachedGames = [...epicGames, ...gogGames, ...steamGames];

      if (cachedGames.length === 0) {
        return interaction.editReply('😔 Nenhum jogo gratuito no momento!');
      }

      const embed = createListEmbed(cachedGames);
      const selectMenu = createSelectMenu(cachedGames);
      const refreshButton = createRefreshButton();

      await interaction.message.edit({
        embeds: [embed],
        components: [selectMenu, refreshButton]
      });

      // Atualiza o ID salvo
      savePanel(interaction.message.id, process.env.FREE_GAMES_CHANNEL_ID);

      await interaction.editReply('✅ Lista atualizada!');
    }
  });
}

// ==================== SETUP ====================
export function setupFreeGames(client) {
  console.log('[FreeGames] Monitor de jogos gratuitos iniciado!');

  setupFreeGamesInteractions(client);

  setTimeout(() => checkAndNotify(client), 30 * 1000);
  setInterval(() => checkAndNotify(client), CHECK_INTERVAL);
}