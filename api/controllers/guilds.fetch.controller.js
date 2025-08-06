
const guildsFetch = async (req, res) => {
    const client = req.client;
    const guilds = client.guilds.cache.map(g => ({
        id: g.id,
        name: g.name
    }));
    res.json({ guilds });
}

module.exports = {guildsFetch};