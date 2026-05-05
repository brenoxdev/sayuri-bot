import Database from 'better-sqlite3';

const db = new Database('./db/levels.db');

db.exec(`CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1
)`);

const LEVEL_ROLES = {
  5:  process.env.ROLE_LEVEL_5  ?? '',
  10: process.env.ROLE_LEVEL_10 ?? '',
  20: process.env.ROLE_LEVEL_20 ?? '',
  50: process.env.ROLE_LEVEL_50 ?? '',
};

const cooldowns = new Map();

export function setupLeveling(client) {
  client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;

    // Comandos de rank
    if (msg.content.startsWith('!rank') || msg.content.startsWith('!xp')) {
      const target = msg.mentions.users.first() ?? msg.author;
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(target.id);

      if (!user) {
        return msg.reply(`❌ **${target.username}** ainda não tem XP acumulado.`);
      }

      const xpNeeded = user.level * 100;
      const progress = Math.floor((user.xp / xpNeeded) * 10);
      const bar = '█'.repeat(progress) + '░'.repeat(10 - progress);

      return msg.reply(
        `📊 **${target.username}**\n` +
        `🏆 Nível: **${user.level}**\n` +
        `✨ XP: **${user.xp}** / **${xpNeeded}**\n` +
        `[${bar}] ${Math.floor((user.xp / xpNeeded) * 100)}%`
      );
    }

    // Comando de ranking geral
    if (msg.content.startsWith('!top')) {
      const top = db.prepare('SELECT * FROM users ORDER BY level DESC, xp DESC LIMIT 10').all();

      if (!top.length) return msg.reply('❌ Nenhum usuário no ranking ainda.');

      const lines = await Promise.all(top.map(async (u, i) => {
        const member = await msg.guild.members.fetch(u.id).catch(() => null);
        const name = member?.user.username ?? `Usuário ${u.id}`;
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        return `${medal} **${name}** — Nível ${u.level} (${u.xp} XP)`;
      }));

      return msg.reply(`🏆 **Top 10 do servidor:**\n${lines.join('\n')}`);
    }

    // Sistema de XP — cooldown de 60s
    const now = Date.now();
    const lastMsg = cooldowns.get(msg.author.id) ?? 0;
    if (now - lastMsg < 60_000) return;
    cooldowns.set(msg.author.id, now);

    const xpGain = Math.floor(Math.random() * 10) + 15;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(msg.author.id)
      ?? { id: msg.author.id, xp: 0, level: 1 };

    const newXp = user.xp + xpGain;
    const xpNeeded = user.level * 100;
    let newLevel = user.level;

    if (newXp >= xpNeeded) {
      newLevel++;
      await msg.reply(
        `🎉 **${msg.author.username}** subiu para o **nível ${newLevel}**!\n` +
        `Próximo nível em **${newLevel * 100} XP**.`
      );
      await assignRoleForLevel(msg.member, newLevel);
    }

    db.prepare(`
      INSERT INTO users (id, xp, level) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET xp = ?, level = ?
    `).run(msg.author.id, newXp, newLevel, newXp, newLevel);
  });
}

async function assignRoleForLevel(member, newLevel) {
  const allLevelRoleIds = Object.values(LEVEL_ROLES).filter(Boolean);

  for (const roleId of allLevelRoleIds) {
    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId).catch(() => {});
    }
  }

  const eligibleLevels = Object.keys(LEVEL_ROLES)
    .map(Number)
    .filter(lvl => newLevel >= lvl && LEVEL_ROLES[lvl])
    .sort((a, b) => b - a);

  const highest = eligibleLevels[0];
  if (!highest) return;

  const role = member.guild.roles.cache.get(LEVEL_ROLES[highest]);
  if (role) await member.roles.add(role).catch(() => {});
}