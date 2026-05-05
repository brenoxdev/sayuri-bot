export function setupRoles(client) {
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName !== 'cargo') return;
  
      if (!interaction.member.permissions.has('ManageRoles')) {
        return interaction.reply({
          content: '❌ Você não tem permissão para gerenciar cargos.',
          ephemeral: true
        });
      }
  
      const sub = interaction.options.getSubcommand();
      const targetMember = interaction.options.getMember('usuario');
      const role = interaction.options.getRole('cargo');
      const botMember = interaction.guild.members.me;
  
      if (role.position >= botMember.roles.highest.position) {
        return interaction.reply({
          content: '❌ Esse cargo está acima do meu nível de permissão.',
          ephemeral: true
        });
      }
  
      try {
        if (sub === 'adicionar') {
          await targetMember.roles.add(role);
          await interaction.reply(`✅ Cargo **${role.name}** adicionado a **${targetMember.user.username}**.`);
        } else if (sub === 'remover') {
          await targetMember.roles.remove(role);
          await interaction.reply(`✅ Cargo **${role.name}** removido de **${targetMember.user.username}**.`);
        }
      } catch (err) {
        await interaction.reply({ content: `❌ Erro: ${err.message}`, ephemeral: true });
      }
    });
  }