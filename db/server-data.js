import fs from 'fs';
import path from 'path';

let cachedData = null;
let lastUpdate = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export async function saveServerData(client, guildId) {
  const now = Date.now();
  
  // Retorna cache se ainda válido
  if (cachedData && (now - lastUpdate) < CACHE_DURATION) {
    console.log('[ServerData] Usando cache (válido por mais', Math.floor((CACHE_DURATION - (now - lastUpdate)) / 1000), 'segundos)');
    return cachedData;
  }

  console.log('[ServerData] Atualizando dados do servidor...');

  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      console.error('[ServerData] Guild não encontrada no cache');
      return cachedData || 'Servidor não encontrado.';
    }

    // Usa apenas o cache, sem fazer fetch (evita rate limit)
    const members = guild.members.cache;
    const humanMembers = members.filter(m => !m.user.bot);
    const channels = guild.channels.cache;
    const roles = guild.roles.cache;
    const owner = guild.members.cache.get(guild.ownerId);

    const onlineMembers = humanMembers.filter(m =>
      ['online', 'idle', 'dnd'].includes(m.presence?.status)
    );

    const memberList = humanMembers.map(m => {
      const mRoles = m.roles.cache
        .filter(r => r.name !== '@everyone')
        .map(r => r.name)
        .join(', ');
      const status = m.presence?.status ?? 'offline';
      return `- ${m.user.username} | status: ${status} | cargos: ${mRoles || 'nenhum'}`;
    }).join('\n');

    const roleList = roles
      .filter(r => r.name !== '@everyone')
      .sort((a, b) => b.position - a.position)
      .map(r => `- ${r.name}: ${r.members.size} membro(s)`)
      .join('\n');

    const textChannels = channels
      .filter(c => c.type === 0)
      .map(c => `#${c.name}`)
      .join(', ');

    const voiceChannels = channels
      .filter(c => c.type === 2)
      .map(c => c.name)
      .join(', ');

    const data = `
DADOS DO SERVIDOR DISCORD - ${new Date().toLocaleString('pt-BR')}
================================================================
Nome: ${guild.name}
ID: ${guild.id}
Dono: ${owner?.user.username ?? 'Desconhecido'} (ID: ${guild.ownerId})
Criado em: ${guild.createdAt.toLocaleDateString('pt-BR')}
Total de membros humanos: ${humanMembers.size}
Total de bots: ${members.filter(m => m.user.bot).size}
Membros online agora: ${onlineMembers.size}
Boosters: ${guild.premiumSubscriptionCount}
Nível de boost: Tier ${guild.premiumTier}

CARGOS (${roles.filter(r => r.name !== '@everyone').size} cargos):
${roleList}

CANAIS DE TEXTO (${channels.filter(c => c.type === 0).size}):
${textChannels}

CANAIS DE VOZ (${channels.filter(c => c.type === 2).size}):
${voiceChannels}

MEMBROS (${humanMembers.size}):
${memberList}
`.trim();

    fs.writeFileSync('./db/server-context.txt', data, 'utf-8');
    console.log('[ServerData] Dados salvos em db/server-context.txt');
    
    cachedData = data;
    lastUpdate = now;
    
    return cachedData;

  } catch (err) {
    console.error('[ServerData] Erro ao salvar dados:', err.message);
    // Retorna cache antigo se houver erro
    return cachedData || 'Erro ao carregar dados do servidor.';
  }
}