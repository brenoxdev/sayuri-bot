// Edita aqui: messageId → { emoji → roleId }
const REACTION_ROLES = {
    'ID_DA_MENSAGEM': {
      '🎮': 'ID_CARGO_GAMER',
      '🎵': 'ID_CARGO_MUSICO',
      '🎨': 'ID_CARGO_DESIGNER',
    }
  };
  
  export function setupReactionRoles(client) {
    client.on('messageReactionAdd', async (reaction, user) => {
      if (user.bot) return;
      if (reaction.partial) await reaction.fetch().catch(() => {});
  
      const roles = REACTION_ROLES[reaction.message.id];
      if (!roles) return;
  
      const roleId = roles[reaction.emoji.name];
      if (!roleId) return;
  
      const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
      if (!member) return;
  
      const role = reaction.message.guild.roles.cache.get(roleId);
      if (role) await member.roles.add(role).catch(() => {});
    });
  
    client.on('messageReactionRemove', async (reaction, user) => {
      if (user.bot) return;
      if (reaction.partial) await reaction.fetch().catch(() => {});
  
      const roles = REACTION_ROLES[reaction.message.id];
      if (!roles) return;
  
      const roleId = roles[reaction.emoji.name];
      if (!roleId) return;
  
      const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
      if (!member) return;
  
      const role = reaction.message.guild.roles.cache.get(roleId);
      if (role) await member.roles.remove(role).catch(() => {});
    });
  }