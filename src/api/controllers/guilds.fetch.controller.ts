import { Request, Response, NextFunction } from 'express';

export async function guildsFetch(req:Request,res:Response){
    const client = req.client;
    const guilds = client.guilds.cache.map(g => ({
        id: g.id,
        name: g.name
    }));
    res.json({ guilds });
}
