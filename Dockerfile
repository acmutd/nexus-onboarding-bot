FROM node:20-bullseye

#set workd directory
WORKDIR /app 
RUN apt-get update && apt-get install python3-pip -y

COPY ./ ./
#installing node_modules first
RUN ls ./ > files.txt
RUN cat files.txt
#RUN npm install 

#RUN python3 --version

#changing word dir to superdoc dir 
#RUN apt-get install python3-venv -y
WORKDIR /app/superdoc 

#installing all of the needed requirements
#RUN python3 -m venv venv
#RUN source venv/bin/activate
RUN pip install -r requirements.txt

WORKDIR /app

EXPOSE 8080

#docker run -p 9000:8080 --rm --init  nexus_bot


