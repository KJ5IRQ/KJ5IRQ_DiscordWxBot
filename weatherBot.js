require('dotenv').config();

const fetch = require('node-fetch');
const { Client, Intents, MessageEmbed } = require('discord.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;  // Replace this with your DISCORD token
const CHANNEL_ID = '1381310194797252770';     // Replace this with your CHANNEL_ID


// Prioritized counties based on climatology analysis
const countiesByPriority = {
  primary: ['Palo Pinto'],
  secondary: ['Jack', 'Stephens', 'Young'],
  tertiary: ['Eastland', 'Erath', 'Hood', 'Parker'],
};

// Embed colors per priority
const priorityColors = {
  primary: '#FF0000',   // Red
  secondary: '#FFA500', // Orange
  tertiary: '#FFFF00',  // Yellow
};

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

// Map alert ID => Discord message ID for duplicates and expiry
const postedAlerts = new Map();

// Determine alert priority by checking counties in areaDesc string
function getAlertPriority(areaDesc) {
  areaDesc = areaDesc.toLowerCase();
  for (const county of countiesByPriority.primary) {
    if (areaDesc.includes(county.toLowerCase())) return 'primary';
  }
  for (const county of countiesByPriority.secondary) {
    if (areaDesc.includes(county.toLowerCase())) return 'secondary';
  }
  for (const county of countiesByPriority.tertiary) {
    if (areaDesc.includes(county.toLowerCase())) return 'tertiary';
  }
  return null;
}

async function fetchAlerts() {
  try {
    const response = await fetch('https://api.weather.gov/alerts/active?area=TX');
    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      console.log('No active alerts from NWS.');
      return;
    }

    const channel = await client.channels.fetch(CHANNEL_ID);

    const currentAlertIds = new Set(data.features.map(alert => alert.id));

    // Expire old alerts by editing messages
    for (const [alertId, messageId] of postedAlerts.entries()) {
      if (!currentAlertIds.has(alertId)) {
        try {
          const message = await channel.messages.fetch(messageId);
          if (!message) {
            postedAlerts.delete(alertId);
            continue;
          }
          const oldEmbed = message.embeds[0];
          if (!oldEmbed) {
            postedAlerts.delete(alertId);
            continue;
          }

          const expiredEmbed = new MessageEmbed(oldEmbed)
            .setTitle(`⚠️ EXPIRED ALERT ⚠️ ${oldEmbed.title.replace(/^\[.*\]\s*/, '')}`)
            .setColor('#555555')
            .setFooter({ text: 'This alert has expired.' });

          await message.edit({ embeds: [expiredEmbed] });
          postedAlerts.delete(alertId);
          console.log(`Marked alert expired: ${alertId}`);
        } catch (err) {
          console.warn(`Failed to edit expired alert message ${messageId}:`, err);
          postedAlerts.delete(alertId);
        }
      }
    }

    // Post new alerts based on priority
    for (const alert of data.features) {
      const props = alert.properties;
      const priority = getAlertPriority(props.areaDesc);
      if (!priority) {
        console.log(`Skipping alert (no relevant county): ${props.event} - Areas: ${props.areaDesc}`);
        continue;
      }
      if (postedAlerts.has(alert.id)) {
        console.log(`Already posted alert: ${props.event} - ID: ${alert.id}`);
        continue;
      }

      const embed = new MessageEmbed()
        .setTitle(`[${priority.toUpperCase()}] 🚨 ${props.event} 🚨`)
        .setDescription(props.description)
        .addFields([
          { name: 'Affected Area', value: props.areaDesc, inline: true },
          { name: 'Severity', value: props.severity, inline: true },
          { name: 'Effective', value: new Date(props.effective).toLocaleString(), inline: true },
          { name: 'Expires', value: new Date(props.expires).toLocaleString(), inline: true },
        ])
        .setURL(props.web)
        .setColor(priorityColors[priority])
        .setTimestamp(new Date(props.sent));

      const sentMessage = await channel.send({ embeds: [embed] });
      postedAlerts.set(alert.id, sentMessage.id);
      console.log(`Posted new [${priority}] alert: ${props.event} - ID: ${alert.id}`);
    }
  } catch (e) {
    console.error('Failed to fetch or post alerts:', e);
  }
}

client.once('ready', async () => {
  console.log(`Bot online as ${client.user.tag}`);

  const channel = await client.channels.fetch(CHANNEL_ID);
  await channel.send('🌪️ Wx-Ops Bot online — Multi-tier AO active! Stay sharp.');

  client.user.setPresence({
    activities: [{ name: 'Weather Ops | Wx-Ops Bot', type: 'WATCHING' }],
    status: 'online',
  });

  fetchAlerts();
  setInterval(fetchAlerts, 2 * 60 * 1000);
});

client.login(DISCORD_TOKEN);
