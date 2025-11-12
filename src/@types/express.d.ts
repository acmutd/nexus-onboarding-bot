import { Client, SlashCommandBuilder } from 'discord.js';

declare global {
  namespace Express {
    interface Request {
      client: Client;
    }
  }
}

declare global {
  interface Course {
    course_number: string,
    course_prefixes: string[], 
    sections: string[],
    title: string,
    instructors: string[],
    class_numbers: string[], 
    enrolled_current: number, 
    enrolled_max: number,
    assistants: string[],
    dept: string
  }
  
  interface Command {
    execute: Function,
    data: SlashCommandBuilder
  }
}

export {};
