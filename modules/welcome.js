import { createCanvas, loadImage } from 'canvas';
import { EmbedBuilder, AttachmentBuilder } from 'discord.js';

const WELCOME_CHANNEL_ID = '1429652430815232060';
const GOODBYE_CHANNEL_ID = '1429704060520366144';

async function generateWelcomeImage(member) {
  const canvas = createCanvas(900, 300);
  const ctx = canvas.getContext('2d');

  // Fundo gradiente roxo
  const gradient = ctx.createLinearGradient(0, 0, 900, 300);
  gradient.addColorStop(0, '#0d0d1a');
  gradient.addColorStop(0.5, '#1a0a2e');
  gradient.addColorStop(1, '#0d0d1a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 900, 300);

  // Partículas
  ctx.fillStyle = 'rgba(155, 89, 182, 0.15)';
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * 900;
    const y = Math.random() * 300;
    const r = Math.random() * 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bordas laterais
  const borderGradient = ctx.createLinearGradient(0, 0, 0, 300);
  borderGradient.addColorStop(0, 'transparent');
  borderGradient.addColorStop(0.5, '#9B59B6');
  borderGradient.addColorStop(1, 'transparent');
  ctx.fillStyle = borderGradient;
  ctx.fillRect(0, 0, 4, 300);
  ctx.fillRect(896, 0, 4, 300);

  // Linhas decorativas
  ctx.strokeStyle = 'rgba(155, 89, 182, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(200, 30);
  ctx.lineTo(870, 30);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(200, 270);
  ctx.lineTo(870, 270);
  ctx.stroke();

  // Avatar
  try {
    const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    const avatar = await loadImage(avatarURL);

    ctx.shadowColor = '#9B59B6';
    ctx.shadowBlur = 20;
    ctx.save();
    ctx.beginPath();
    ctx.arc(130, 150, 90, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 40, 60, 180, 180);
    ctx.restore();
    ctx.shadowBlur = 0;

    // Borda do avatar
    ctx.strokeStyle = '#9B59B6';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(130, 150, 90, 0, Math.PI * 2);
    ctx.stroke();

    // Bolinha verde online
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.arc(195, 215, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0d0d1a';
    ctx.lineWidth = 3;
    ctx.stroke();

  } catch (err) {
    console.error('[Welcome] Erro ao carregar avatar:', err.message);
  }

  // Título
  ctx.shadowColor = '#9B59B6';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#9B59B6';
  ctx.font = 'bold 28px Sans';
  ctx.fillText('— BEM-VINDO(A) AO SERVIDOR —', 240, 80);
  ctx.shadowBlur = 0;

  // Nome do usuário
  const username = member.user.username;
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 15;
  ctx.fillStyle = '#ffffff';
  const fontSize = username.length > 15 ? 42 : username.length > 10 ? 52 : 62;
  ctx.font = `bold ${fontSize}px Sans`;
  ctx.fillText(username, 240, 165);
  ctx.shadowBlur = 0;

  // Número do membro
  const memberCount = member.guild.memberCount;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '22px Sans';
  ctx.fillText(`Membro #${memberCount} do servidor`, 240, 210);

  // Tag do servidor
  ctx.fillStyle = 'rgba(155, 89, 182, 0.8)';
  ctx.fillRect(240, 230, 380, 35);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Sans';
  ctx.fillText(`✨  ${member.guild.name}  ✨`, 255, 253);

  return canvas.toBuffer('image/png');
}

async function generateGoodbyeImage(member) {
  const canvas = createCanvas(900, 300);
  const ctx = canvas.getContext('2d');

  // Fundo gradiente vermelho/escuro
  const gradient = ctx.createLinearGradient(0, 0, 900, 300);
  gradient.addColorStop(0, '#0d0d0d');
  gradient.addColorStop(0.5, '#1a0505');
  gradient.addColorStop(1, '#0d0d0d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 900, 300);

  // Partículas vermelhas
  ctx.fillStyle = 'rgba(231, 76, 60, 0.15)';
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * 900;
    const y = Math.random() * 300;
    const r = Math.random() * 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bordas laterais vermelhas
  const borderGradient = ctx.createLinearGradient(0, 0, 0, 300);
  borderGradient.addColorStop(0, 'transparent');
  borderGradient.addColorStop(0.5, '#e74c3c');
  borderGradient.addColorStop(1, 'transparent');
  ctx.fillStyle = borderGradient;
  ctx.fillRect(0, 0, 4, 300);
  ctx.fillRect(896, 0, 4, 300);

  // Linhas decorativas
  ctx.strokeStyle = 'rgba(231, 76, 60, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(200, 30);
  ctx.lineTo(870, 30);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(200, 270);
  ctx.lineTo(870, 270);
  ctx.stroke();

  // Avatar em preto e branco
  try {
    const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    const avatar = await loadImage(avatarURL);

    ctx.shadowColor = '#e74c3c';
    ctx.shadowBlur = 20;
    ctx.save();
    ctx.beginPath();
    ctx.arc(130, 150, 90, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 40, 60, 180, 180);

    // Overlay cinza para efeito de "saída"
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(40, 60, 180, 180);
    ctx.restore();
    ctx.shadowBlur = 0;

    // Borda vermelha
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(130, 150, 90, 0, Math.PI * 2);
    ctx.stroke();

    // Bolinha cinza (offline)
    ctx.fillStyle = '#95a5a6';
    ctx.beginPath();
    ctx.arc(195, 215, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0d0d0d';
    ctx.lineWidth = 3;
    ctx.stroke();

  } catch (err) {
    console.error('[Welcome] Erro ao carregar avatar:', err.message);
  }

  // Título
  ctx.shadowColor = '#e74c3c';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 28px Sans';
  ctx.fillText('— ATÉ MAIS, VIAJANTE... —', 240, 80);
  ctx.shadowBlur = 0;

  // Nome do usuário
  const username = member.user.username;
  ctx.shadowColor = 'rgba(255,255,255,0.5)';
  ctx.shadowBlur = 15;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  const fontSize = username.length > 15 ? 42 : username.length > 10 ? 52 : 62;
  ctx.font = `bold ${fontSize}px Sans`;
  ctx.fillText(username, 240, 165);
  ctx.shadowBlur = 0;

  // Membros restantes
  const memberCount = member.guild.memberCount;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '22px Sans';
  ctx.fillText(`O servidor agora tem ${memberCount} membros`, 240, 210);

  // Tag do servidor
  ctx.fillStyle = 'rgba(231, 76, 60, 0.7)';
  ctx.fillRect(240, 230, 380, 35);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Sans';
  ctx.fillText(`💔  ${member.guild.name}  💔`, 255, 253);

  return canvas.toBuffer('image/png');
}

function getWelcomeMessage(member) {
  const messages = [
    `opa <@${member.id}>, chegou mais um! 🎉 seja bem-vindo(a) ao servidor, espero que curta por aqui!`,
    `eii <@${member.id}>! finalmente apareceu kkkk seja bem-vindo(a), bora se apresentar! 👋`,
    `oi oi <@${member.id}>! mais um(a) chegando... seja bem-vindo(a) ao caos kkkkk 🔥`,
    `uuul <@${member.id}> chegou! bem-vindo(a) ao servidor, aproveita e se apresenta pra galera! 🥳`,
    `chegou mais um(a)! seja muito bem-vindo(a) <@${member.id}>, aqui a gente é família ❤️`,
    `opa <@${member.id}>! bem-vindo(a) ao servidor! espero que vc curta muito por aqui 🎊`,
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

function getGoodbyeMessage(member) {
  const messages = [
    `poxa, **${member.user.username}** foi embora... 😢 vai com deus, volta sempre!`,
    `xi, **${member.user.username}** saiu do servidor... espero que a gente não tenha feito nada não kkkkk 😅`,
    `**${member.user.username}** nos deixou... 💔 vai fazer falta por aqui!`,
    `eita, **${member.user.username}** foi... tchau tchau, cuida-se aí fora! 👋`,
    `**${member.user.username}** saiu... 😔 foi bom enquanto durou, né? kkkkk`,
    `xi, perdemos mais um(a)... **${member.user.username}** foi embora 😢 boa sorte aí fora!`,
    `**${member.user.username}** deu o fora... nem se despediu direito kkkk vai com deus! 🙏`,
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

export function setupWelcome(client) {
  // ==================== BOAS-VINDAS ====================
  client.on('guildMemberAdd', async (member) => {
    if (member.guild.id !== process.env.GUILD_ID) return;
    console.log(`[Welcome] Novo membro: ${member.user.username}`);

    try {
      const channel = client.channels.cache.get(WELCOME_CHANNEL_ID);
      if (!channel) {
        console.error('[Welcome] Canal de boas-vindas não encontrado!');
        return;
      }

      const imageBuffer = await generateWelcomeImage(member);
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome.png' });
      const message = getWelcomeMessage(member);

      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setDescription(`📌 Não esquece de ler as regras e se apresentar pra galera!\n🎮 Aproveita e olha os canais disponíveis!`)
        .setFooter({ text: `${member.guild.name} • Seja bem-vindo(a)!` });

      await channel.send({
        content: message,
        files: [attachment],
        embeds: [embed]
      });

      console.log(`[Welcome] ✅ Boas-vindas enviado para ${member.user.username}!`);

    } catch (err) {
      console.error('[Welcome] Erro no boas-vindas:', err.message);
    }
  });

  // ==================== DESPEDIDA ====================
  client.on('guildMemberRemove', async (member) => {
    if (member.guild.id !== process.env.GUILD_ID) return;
    console.log(`[Welcome] Membro saiu: ${member.user.username}`);

    try {
      const channel = client.channels.cache.get(GOODBYE_CHANNEL_ID);
      if (!channel) {
        console.error('[Welcome] Canal de despedida não encontrado!');
        return;
      }

      const imageBuffer = await generateGoodbyeImage(member);
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'goodbye.png' });
      const message = getGoodbyeMessage(member);

      const embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setDescription(`O servidor agora tem **${member.guild.memberCount}** membros.`)
        .setFooter({ text: `${member.guild.name} • Até mais!` });

      await channel.send({
        content: message,
        files: [attachment],
        embeds: [embed]
      });

      console.log(`[Welcome] ✅ Despedida enviada para ${member.user.username}!`);

    } catch (err) {
      console.error('[Welcome] Erro na despedida:', err.message);
    }
  });

  console.log('[Welcome] ✅ Sistema de boas-vindas e despedida iniciado!');
}