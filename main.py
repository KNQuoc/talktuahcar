from fastapi import FastAPI
import socketio
from pymongo import MongoClient

app = FastAPI()
sio = socketio.AsyncServer(async_mode='asgi')
sio_app = socketio.ASGIApp(sio, other_asgi_app=app)

client = MongoClient('mongodb://localhost:27017/')
db = client['test']
call_collection = db['calls']

@app.post("/save-call/")

async def save_call(caller: str, receiver: str, start_time: str, end_time: str):
    call_collection.insert_one({
        'caller': caller,
        'receiver': receiver,
        'start_time': start_time,
        'end_time': end_time
    })
    return {"status": "success"}

@sio.event
async def connect(sid, environ):
    print('connect ', sid)

@sio.event
async def join_call(sid, room):
    sio.enter_room(sid, room)
    await sio.emit('user-connected', sid, room=room)

@sio.event
async def signal(sid, data):
    await sio.emit('signal', {'from': data['from'], 'signal': data['signal']}, room=data['to'])

@sio.event
async def disconnect(sid):
    print('Client disconnected:', sid)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(sio_app, host="0.0.0.0", port=8000)