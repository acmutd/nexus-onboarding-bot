import { Client } from 'discord.js'; // or whatever type your client is

declare global {
  namespace Express {
    interface Request {
      client: Client; // or the appropriate type for your client
    }
  }
}

declare global{
  interface Course{
    course_number:string,
    course_prefixes:string[], 
    sections:string[],
    title:string,
    instructors:string[],
    class_numbers:string[], 
    enrolled_current:number, 
    enrolled_max: number,
    assistants:string[],
    dept:string
  }
}
