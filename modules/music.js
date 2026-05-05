import { DisTube } from 'distube';
import { YtDlpPlugin } from '@distube/yt-dlp';
import { SpotifyPlugin } from '@distube/spotify';
import { SoundCloudPlugin } from '@distube/soundcloud';
import { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js';

let distube = null;

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function createMusicEmbed(queue, song) {
  if (!song) {
    return new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('🎵 Nenhuma música tocando')
      .setDescription('Use `!play <música>` para adicionar músicas');
  }

  const progress = '▬'.repeat(20);

  const embed = new EmbedBuilder()
    .setColor('#9B59B6')
    .setTitle('🎵 Now playing')
    .setDescription(`**${song.name}**`)
    .setThumbnail(song.thumbnail)
    .addFields(
      { name: '⏱️ Duração', value: song.formattedDuration, inline: true },
      { name: '🔊 Volume', value: `${queue.volume}%`, inline: true },
      { name: '🔁 Loop', value: queue.repeatMode ? '✅ Ativado' : '❌ Desligado', inline: true },
      { name: '🎤 Requested by', value: `@${song.user.username}`, inline: false },
      { name: '📊 Progresso', value: `0:00 ${progress} ${song.formattedDuration}`, inline: false }
    );

  if (queue.songs.length > 1) {
    embed.setFooter({ text: `📋 Fila: ${queue.songs.length - 1} música(s)` });
  }

  return embed;
}

function createControlButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music_previous')
      .setEmoji('⏮️')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('music_play_pause')
      .setEmoji('⏯️')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('music_stop')
      .setEmoji('⏹️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('music_next')
      .setEmoji('⏭️')
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music_volume_down')
      .setEmoji('🔉')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_loop')
      .setEmoji('🔁')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_queue')
      .setEmoji('📋')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_volume_up')
      .setEmoji('🔊')
      .setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
}

function createQueueMenu() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('queue_back')
      .setLabel('◀️ Voltar')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('queue_add')
      .setLabel('➕ Adicionar')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('queue_delete')
      .setLabel('🗑️ Deletar')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('queue_close')
      .setLabel('❌ Fechar')
      .setStyle(ButtonStyle.Secondary)
  );

  return [row1];
}

function createDeleteMenu(queue) {
  if (!queue || queue.songs.length <= 1) {
    return null;
  }

  const options = queue.songs.slice(1).map((song, index) => 
    new StringSelectMenuOptionBuilder()
      .setLabel(`${index + 1}. ${song.name.substring(0, 90)}`)
      .setValue(`delete_${index + 1}`)
      .setDescription(`Por: ${song.user.username}`)
  );

  if (options.length === 0) return null;

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('music_delete_select')
    .setPlaceholder('Selecione músicas para deletar')
    .setMinValues(1)
    .setMaxValues(Math.min(options.length, 25))
    .addOptions(options);

  return new ActionRowBuilder().addComponents(selectMenu);
}

const dashboardMessages = new Map();

async function updateDashboard(queue) {
  const guildId = queue.voiceChannel?.guild?.id;
  if (!guildId) return;

  const dashboardMsg = dashboardMessages.get(guildId);
  if (!dashboardMsg) return;

  try {
    const embed = createMusicEmbed(queue, queue.songs[0]);
    const buttons = createControlButtons();
    
    await dashboardMsg.edit({
      embeds: [embed],
      components: buttons
    });
  } catch (err) {
    console.error('[Music] Erro ao atualizar dashboard:', err.message);
  }
}

export function setupMusic(client) {
  distube = new DisTube(client, {
    emitNewSongOnly: true,
    savePreviousSongs: true,
    plugins: [
      new YtDlpPlugin({
        update: false
      }),
      new SpotifyPlugin(),
      new SoundCloudPlugin()
    ]
  });

  // Eventos do DisTube
  distube.on('playSong', async (queue, song) => {
    const embed = createMusicEmbed(queue, song);
    const buttons = createControlButtons();

    const channel = song.member?.guild.channels.cache.get(queue.textChannel?.id);
    if (!channel) return;

    try {
      const dashboardMsg = await channel.send({
        embeds: [embed],
        components: buttons
      });
      dashboardMessages.set(queue.voiceChannel.guild.id, dashboardMsg);
    } catch (err) {
      console.error('[Music] Erro ao enviar dashboard:', err.message);
    }
  });

  distube.on('addSong', (queue, song) => {
    const channel = song.member?.guild.channels.cache.get(queue.textChannel?.id);
    if (channel && queue.songs.length > 1) {
      channel.send(`✅ **${song.name}** adicionada à fila (posição ${queue.songs.length})`);
    }
  });

  distube.on('error', (channel, error) => {
    console.error('[DisTube] Erro:', error);
    if (channel) channel.send('❌ Erro ao tocar a música!');
  });

  // Comando !play
  client.on('messageCreate', async (msg) => {
    if (msg.author.bot || !msg.content.startsWith('!play')) return;

    const voiceChannel = msg.member?.voice.channel;
    if (!voiceChannel) {
      return msg.reply('❌ Entre em um canal de voz primeiro!');
    }

    const query = msg.content.replace('!play', '').trim();
    if (!query) {
      return msg.reply('❌ Digite o nome ou URL da música!');
    }

    try {
      await distube.play(voiceChannel, query, {
        textChannel: msg.channel,
        member: msg.member
      });
    } catch (err) {
      console.error('[Music] Erro:', err);
      msg.reply('❌ Erro ao tocar a música! Tenta com outro nome ou URL.');
    }
  });

  // Botões de controle
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

    // Ignora interações de jogos gratuitos
    if (interaction.customId === 'free_game_select') return;
    if (interaction.customId === 'free_games_refresh') return;

    const queue = distube.getQueue(interaction.guild.id);
    if (!queue && !['music_stop', 'queue_close'].includes(interaction.customId)) {
      return interaction.reply({ content: '❌ Nenhuma música tocando!', ephemeral: true });
    }

    if (interaction.customId === 'music_play_pause') {
      if (queue.paused) {
        distube.resume(interaction.guild.id);
        await interaction.reply({ content: '▶️ Retomado', ephemeral: true });
      } else {
        distube.pause(interaction.guild.id);
        await interaction.reply({ content: '⏸️ Pausado', ephemeral: true });
      }
    }

    else if (interaction.customId === 'music_stop') {
      distube.stop(interaction.guild.id);
      dashboardMessages.delete(interaction.guild.id);
      await interaction.update({ content: '⏹️ Música parada e fila limpa', embeds: [], components: [] });
    }

    else if (interaction.customId === 'music_next') {
      try {
        await distube.skip(interaction.guild.id);
        await interaction.reply({ content: '⏭️ Próxima música', ephemeral: true });
      } catch {
        await interaction.reply({ content: '❌ Não há próxima música', ephemeral: true });
      }
    }

    else if (interaction.customId === 'music_previous') {
      try {
        await distube.previous(interaction.guild.id);
        await interaction.reply({ content: '⏮️ Música anterior', ephemeral: true });
      } catch {
        await interaction.reply({ content: '❌ Não há música anterior', ephemeral: true });
      }
    }

    else if (interaction.customId === 'music_volume_up') {
      const newVolume = Math.min(queue.volume + 10, 200);
      distube.setVolume(interaction.guild.id, newVolume);
      await interaction.reply({ content: `🔊 Volume: ${newVolume}%`, ephemeral: true });
      updateDashboard(queue);
    }

    else if (interaction.customId === 'music_volume_down') {
      const newVolume = Math.max(queue.volume - 10, 0);
      distube.setVolume(interaction.guild.id, newVolume);
      await interaction.reply({ content: `🔉 Volume: ${newVolume}%`, ephemeral: true });
      updateDashboard(queue);
    }

    else if (interaction.customId === 'music_loop') {
      const mode = queue.repeatMode ? 0 : 2;
      distube.setRepeatMode(interaction.guild.id, mode);
      await interaction.reply({ 
        content: `🔁 Loop: ${mode ? 'Ativado' : 'Desativado'}`, 
        ephemeral: true 
      });
      updateDashboard(queue);
    }

    else if (interaction.customId === 'music_queue') {
      const queueList = queue.songs.slice(1)
        .map((song, i) => `${i + 1}. **${song.name}** - ${song.user.username}`)
        .join('\n') || 'Fila vazia';

      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('📋 Fila de Músicas')
        .setDescription(queueList.length > 4000 ? queueList.substring(0, 4000) + '...' : queueList)
        .setFooter({ text: `Total: ${queue.songs.length - 1} música(s)` });

      await interaction.update({
        embeds: [embed],
        components: createQueueMenu()
      });
    }

    else if (interaction.customId === 'queue_back') {
      const embed = createMusicEmbed(queue, queue.songs[0]);
      const buttons = createControlButtons();
      await interaction.update({ embeds: [embed], components: buttons });
    }

    else if (interaction.customId === 'queue_add') {
      await interaction.reply({ 
        content: '✅ Use `!play <música>` no chat para adicionar músicas!', 
        ephemeral: true 
      });
    }

    else if (interaction.customId === 'queue_delete') {
      const deleteMenu = createDeleteMenu(queue);
      if (!deleteMenu) {
        return interaction.reply({ content: '❌ Fila vazia!', ephemeral: true });
      }

      const backButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('queue_back')
          .setLabel('◀️ Voltar')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.update({ components: [deleteMenu, backButton] });
    }

    else if (interaction.customId === 'queue_close') {
      const embed = createMusicEmbed(queue, queue.songs[0]);
      const buttons = createControlButtons();
      await interaction.update({ embeds: [embed], components: buttons });
    }

    else if (interaction.customId === 'music_delete_select') {
      const selectedIndexes = interaction.values.map(v => parseInt(v.split('_')[1]));
      const deletedSongs = [];

      selectedIndexes.sort((a, b) => b - a).forEach(index => {
        if (index < queue.songs.length) {
          deletedSongs.push(queue.songs[index].name);
          queue.songs.splice(index, 1);
        }
      });

      await interaction.reply({ 
        content: `🗑️ Removidas: ${deletedSongs.join(', ')}`, 
        ephemeral: true 
      });

      const embed = createMusicEmbed(queue, queue.songs[0]);
      const buttons = createControlButtons();
      const dashboardMsg = dashboardMessages.get(interaction.guild.id);
      if (dashboardMsg) {
        await dashboardMsg.edit({ embeds: [embed], components: buttons });
      }
    }
  });
}