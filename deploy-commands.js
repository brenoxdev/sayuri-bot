import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const commands = [
  new SlashCommandBuilder()
    .setName('cargo')
    .setDescription('Gerencia cargos de um usuário')
    .addSubcommand(sub => sub
      .setName('adicionar')
      .setDescription('Adiciona um cargo a um usuário')
      .addUserOption(opt => opt.setName('usuario').setDescription('Usuário alvo').setRequired(true))
      .addRoleOption(opt => opt.setName('cargo').setDescription('Cargo a adicionar').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('remover')
      .setDescription('Remove um cargo de um usuário')
      .addUserOption(opt => opt.setName('usuario').setDescription('Usuário alvo').setRequired(true))
      .addRoleOption(opt => opt.setName('cargo').setDescription('Cargo a remover').setRequired(true))
    ),

  new SlashCommandBuilder()
    .setName('falar')
    .setDescription('Bot fala um texto no canal de voz')
    .addStringOption(opt =>
      opt.setName('texto').setDescription('O que o bot vai falar').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('assistente')
    .setDescription('Ativa o assistente de voz com IA no canal de voz'),

].map(cmd => cmd.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

try {
  console.log('🔄 Registrando slash commands...');
  await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );
  console.log('✅ Slash commands registrados!');
} catch (err) {
  console.error('❌ Erro ao registrar commands:', err);
}