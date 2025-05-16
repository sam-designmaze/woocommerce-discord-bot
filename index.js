const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const commands = [
  new SlashCommandBuilder()
    .setName('redeem')
    .setDescription('Redeem your WooCommerce invoice to get a Discord role')
    .addStringOption(option =>
      option.setName('invoiceid')
        .setDescription('Your WooCommerce order ID')
        .setRequired(true)
    )
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands('your_bot_client_id', process.env.GUILD_ID),
      { body: commands },
    );
    console.log('Slash command registered.');
  } catch (error) {
    console.error(error);
  }
})();

client.on('ready', () => {
  console.log(`Bot is logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'redeem') {
    const invoiceId = interaction.options.getString('invoiceid');

    try {
      const response = await axios.get(`${process.env.WC_SITE}/wp-json/wc/v3/orders/${invoiceId}`, {
        auth: {
          username: process.env.WC_KEY,
          password: process.env.WC_SECRET
        }
      });

      const order = response.data;
      if (order.status !== 'completed') {
        return interaction.reply({ content: '❌ Order not completed or does not exist.', ephemeral: true });
      }

      // Save to webhook on WordPress site
      await axios.post(`${process.env.WC_SITE}/wp-json/redeem-log/v1/store`, {
        order_id: invoiceId,
        discord_user: interaction.user.tag,
        discord_id: interaction.user.id
      });

      // Assign role
      const role = interaction.guild.roles.cache.find(r => r.name === process.env.ROLE_NAME);
      if (role) {
        await interaction.member.roles.add(role);
        return interaction.reply(`✅ Role "${role.name}" assigned for invoice ${invoiceId}`);
      } else {
        return interaction.reply(`❌ Role "${process.env.ROLE_NAME}" not found.`);
      }
    } catch (err) {
      console.error(err);
      interaction.reply({ content: '❌ Error verifying your order.', ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
