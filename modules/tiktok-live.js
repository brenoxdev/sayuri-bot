import fetch from 'node-fetch';
import { EmbedBuilder } from 'discord.js';

const CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutos
let isLive = false;

async function checkTikTokLive(username) {
  try {
    const url = `https://www.tiktok.com/@${username}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const html = await response.text();
    
    // Procura pela badge LIVE no HTML
    const livePatterns = [
      /class="[^"]*SpanLiveBadge[^"]*">LIVE/i,
      /class="[^"]*live[^"]*badge[^"]*">LIVE/i,
      /<span[^>]*>LIVE<\/span>/i,
      /\"isLive\":true/i,
      /\"liveStatus\":1/i
    ];

    const foundLive = livePatterns.some(pattern => pattern.test(html));

    console.log(`[TikTok] @${username} - Live detectada:`, foundLive);
    
    return foundLive;

  } catch (error) {
    console.error('[TikTok] Erro ao verificar live:', error.message);
    return false;
  }
}

export function setupTikTokLive(client) {
  const username = process.env.TIKTOK_USERNAME;
  
  if (!username) {
    console.log('[TikTok] Username não configurado. Pulando...');
    return;
  }

  console.log(`[TikTok] Monitorando @${username} a cada ${CHECK_INTERVAL / 60000} minutos`);

  setInterval(async () => {
    try {
      const nowLive = await checkTikTokLive(username);

      // Só notifica se mudou de status (não estava live e agora está)
      if (nowLive && !isLive) {
        console.log(`[TikTok] @${username} está ao vivo!`);
        
        const notifChannel = client.channels.cache.get(process.env.NOTIF_CHANNEL_ID);
        const mainChannel = client.channels.cache.get(process.env.MAIN_CHANNEL_ID);
        
        if (!notifChannel) {
          console.error('[TikTok] Canal de notificações não encontrado');
          return;
        }

        // Embed para o canal de notificações (liveon)
        const embed = new EmbedBuilder()
          .setColor('#FF0050')
          .setTitle('🔴 LIVE NO TIKTOK!')
          .setDescription(`**@${username}** está ao vivo agora!`)
          .setURL(`https://www.tiktok.com/@${username}/live`)
          .setThumbnail('https://sf16-website-login.neutral.ttwstatic.com/obj/tiktok_web_login_static/tiktok/webapp/main/webapp-desktop/8152caf0c8e8bc67ae0d.png')
          .setTimestamp()
          .setFooter({ text: 'TikTok Live' });

        // Notifica no canal liveon com @everyone
        await notifChannel.send({ 
          content: '@everyone', 
          embeds: [embed] 
        });

        // Notifica no canal sms (main channel)
        if (mainChannel) {
          await mainChannel.send(`🔴 Pessoal, o Yu está ao vivo no TikTok! Clique no canal <#${process.env.NOTIF_CHANNEL_ID}> e vem assistir a live! 🎥`);
        }

        isLive = true;
      } 
      // Se estava live e agora não está mais
      else if (!nowLive && isLive) {
        console.log(`[TikTok] @${username} encerrou a live`);
        isLive = false;
      }

    } catch (error) {
      console.error('[TikTok] Erro no loop de verificação:', error.message);
    }
  }, CHECK_INTERVAL);

  // Primeira verificação imediata
  setTimeout(async () => {
    const nowLive = await checkTikTokLive(username);
    if (nowLive) {
      isLive = true;
      console.log(`[TikTok] @${username} já está em live!`);
    }
  }, 5000);
}