const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ]
});

// Define slash command
const commands = [
  new SlashCommandBuilder()
    .setName('redeem')
    .setDescription('Redeem your WooCommerce invoice ID')
    .addStringOption(option =>
      option.setName('invoiceid')
        .setDescription('Enter your WooCommerce order ID')
        .setRequired(true)
    )
].map(command => command.toJSON());

// Register slash command on bot startup
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔁 Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash commands registered.');
  } catch (err) {
    console.error('❌ Error registering commands:', err);
  }
})();

// Handle bot ready
client.once('ready', () => {
  console.log(`🤖 Bot logged in as ${client.user.tag}`);
});

// Handle slash command interaction
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'redeem') {
    const invoiceId = interaction.options.getString('invoiceid');

    try {
      // Call WooCommerce API
      const orderRes = await axios.get(`${process.env.WC_SITE}/wp-json/wc/v3/orders/${invoiceId}`, {
        auth: {
          username: process.env.WC_KEY,
          password: process.env.WC_SECRET,
        }
      });

      const order = orderRes.data;

      if (order.status !== 'completed') {
        return interaction.reply({ content: `❌ Order ${invoiceId} is not completed.`, ephemeral: true });
      }

      // Send data to WP to log redemption
      await axios.post(`${process.env.WC_SITE}/wp-json/redeem-log/v1/store`, {
        order_id: invoiceId,
        discord_user: interaction.user.tag,
        discord_id: interaction.user.id,
      });

      // Assign role
      const role = interaction.guild.roles.cache.find(r => r.name === process.env.ROLE_NAME);
      if (role) {
        await interaction.member.roles.add(role);
        return interaction.reply(`✅ Order ${invoiceId} validated. Role "${role.name}" assigned.`);
      } else {
        return interaction.reply(`❌ Role "${process.env.ROLE_NAME}" not found on server.`);
      }

    } catch (error) {
      console.error('❌ Error during redeem:', error);
      return interaction.reply({ content: '❌ Something went wrong. Please try again or contact support.', ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(3000, () => console.log('Web server running on port 3000'));
