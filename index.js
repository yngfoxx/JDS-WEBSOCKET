const app = require('express')()
const server = require('http').createServer(app)
const port = process.env.PORT || 8000;
const io = require('socket.io')(server, {
  cors: {
    origin: '*',
  },
  serveClient: false,
  // below are engine.IO options
  pingInterval: 10000,
  pingTimeout: 5000,
  cookie: false
});

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get('/', (req, res) => { // SERVER OUTPUT
   res.sendFile(__dirname + '/index.html');
   // res.json('Running');
});

const sukey = [
  'FMZur70PbXcT7dYOFdOuzjSpC4xdduMD',
  'u0xx53YtRC77iH1ROnIZSivPeKr2XzzP',
];

const usrkey = [
  'Aj6dN8WfWbPq1HdnHJFXwsXV7MDRrCCU'
];

const pykey = [
  'qPyFMKAdjtfL3Gq5pk2xDgy0SKMpEmLz'
];

// SOCKET SECTION ============================================================================================================================================================>
const admin_server_nsp = io.of(/^\/su_\d+$/);
const user_nsp = io.of(/^\/usr_\d+$/);
const cookie = require('cookie');



// ADMIN SOCKET NAMESPACE/CHANNELS >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\/
admin_server_nsp.use((socket, next) => { // Authenticate admin channel
  let handshake = socket.handshake;
  if (sukey.includes(handshake.auth.token)) return next(); // check authenticity of key
    admin_server_nsp.emit('msg', {socket_type: 'admin', socket_data: '{ADMIN} => ['+socket.id+'] ACCESS DENIED (Invalid key)'}); // send message direct to the admin namespace
  return next(new Error('Authentication error'));
});

admin_server_nsp.on('connection', (socket) => {
  const admin_channel = socket.nsp; // newNamespace.name === '/su_123456'
  let handshake = socket.handshake;

  admin_server_nsp.emit('msg', {socket_type: 'admin', socket_data: '{ADMIN} => ['+socket.id+'] NEW CONNECTION TO '+admin_channel.name}); // send message direct to the admin namespace

  // SOCKET EVENT PROCESSING
  socket.on('msg', (data) => {
    console.log('ADMIN_MSG => '+JSON.stringify(data)); // data received
    admin_server_nsp.emit('msg', {socket_type: 'admin', socket_data: data}); // send message direct to the admin namespace
  });

  // BASIC SOCKET COMMANDS
  socket.on('disconnect', function () {
    admin_server_nsp.emit('msg', {socket_type: 'admin', socket_data: `ADMIN [${socket.id}] DISCONNECTED`}); // send message direct to the admin namespace
  });
});
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>/\



// USER SOCKET NAMESPACE/CHANNEL >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\/
let usrClients = []; // server client list

user_nsp.use((socket, next) => { // Authenticate admin channel
  let handshake = socket.handshake;
  if (usrkey.includes(handshake.auth.token)) return next(); // check authenticity of key
  admin_server_nsp.emit('msg', {socket_type: 'user', socket_data: '{USER} => ['+socket.id+'] ACCESS DENIED (Invalid key)'}); // send message direct to the admin namespace
  return next(new Error('authentication error'));
});

user_nsp.on('connection', (socket) => {
  const user_channel = socket.nsp; // newNamespace.name === '/usr_123456
  let handshake = socket.handshake;
  console.log("\n============================================================================================>");
  // Add client to server client list -------
  let uData = { clientId: handshake.auth.clientId, channel: handshake.auth.channel, type: handshake.auth.type };
  usrClients.push(uData);
  // ----------------------------------------

  // SOCKET ON DISCONNECT EVENT ----------------------------------------------->
  socket.on('disconnect', () => {
    socket.leave(handshake.auth.channel);
    let client = usrClients[usrClients.indexOf(uData)]
    console.log("\n============================================================================================>");
    console.log("\n[*] USER DISCONNECTED FROM SOCKET: "+client.room);

    admin_server_nsp.emit('msg', {socket_type: 'user', socket_data: `[-] USER SOCKET [${socket.id}] DISCONNECTED`}); // send message direct to the admin namespace
    admin_server_nsp.emit('msg', {socket_type: 'admin', socket_data: '{USERS} =>'+JSON.stringify(usrClients)});
  });
  // -------------------------------------------------------------------------->


  // USER CONNECTED ----------------------------------------------------------->
  admin_server_nsp.emit('msg', {socket_type: 'user', socket_data: '{USER} => ['+socket.id+'] NEW CONNECTION TO '+user_channel.name}); // send message direct to the admin namespace


  // GET DEVICE KEY
  const cookies = cookie.parse(socket.request.headers.cookie || '');
  const device_key = (cookies.dKEY || '');


  // SOCKET EVENT PROCESSING
  socket.on('msg', (data) => {
    user_channel.emit('msg', data); // send message direct to the namespace
    admin_server_nsp.emit('msg', {socket_type: 'user', socket_data: data}); // send message direct to the admin namespace
  });
  // -------------------------------------------------------------------------->
});
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>/\






















// PYTHON API SOCKET NAMESPACE/CHANNELS =====================================================================================================================================\/
const python_server_nsp = io.of(/^\/py_\d+$/);
let pyClients = [];

python_server_nsp.on('connection', (socket) => {

  const python_channel = socket.nsp;
  let handshake = socket.handshake;
  let socketGC = (handshake.auth.gc) ? handshake.auth.gc : ((handshake.room) ? handshake.room : 'general');

  console.log("\n============================================================================================>");
  // ADD NEW USER TO pyClients ARRAY (temporary database)
  let uData = { uuid: handshake.auth.uid, room: handshake.auth.gc };
  pyClients.push(uData);



  // SOCKET ON DISCONNECT EVENT ----------------------------------------------->
  socket.on('disconnect', () => {
    socket.leave(handshake.auth.gc);
    let user = pyClients[pyClients.indexOf(uData)]
    console.log("\n============================================================================================>");
    console.log("\n[*] DISCONNECTED FROM SOCKET: "+user.room);


    if (socketGC != 'general') {
      // let arr = {gc: pyClients[pyClients.indexOf(uData)].room, uid: pyClients[pyClients.indexOf(uData)].uuid, status: 'disconnected'};
      // python_server_nsp.to(pyClients[pyClients.indexOf(uData)].room).emit('msg', {response: 'user_status', data: arr}); // send status of all users in the channel
      pyClients.splice(pyClients.indexOf(uData), 1); // remove user from client list
    } else {
      console.log("Socket is in general room");
    }

    admin_server_nsp.emit('msg', {socket_type: 'python', socket_data: `[-] PYTHON SOCKET [${socket.id}] DISCONNECTED`}); // send message direct to the admin namespace
    admin_server_nsp.emit('msg', {socket_type: 'admin', socket_data: '{USERS} =>'+JSON.stringify(pyClients)});
  });
  // -------------------------------------------------------------------------->


  // USER CONNECTED ----------------------------------------------------------->
  // python_server_nsp.to(socketGC).emit('msg', 'Welcome to Joint Downloading System'); // send status of all users in the channel
  admin_server_nsp.emit('msg', {socket_type: 'python', socket_data: `[+] PYTHON SOCKET [${socket.id}] CONNECTED`}); // send message direct to the admin namespace
  admin_server_nsp.emit('msg', {socket_type: 'admin', socket_data: '{USERS} =>'+JSON.stringify(pyClients)}); // Notify admin

  // SOCKET { EVENT } PROCESSING
  socket.on('event', (data) => { // File download event
    data.channel = python_channel.name;
    python_server_nsp.to(data.namespace).emit('msg', data); // send message direct to the namespace
    admin_server_nsp.emit('msg', {socket_type: 'python', socket_data: data}); // send message direct to the admin namespace
    // if (data.file_data) console.log(data.file_data);
  });


  socket.on('join', function(userData) {
    socket.join(userData.gc); // add only users to rooms
    console.log("[+] User entered -> "+userData.gc);
    socket.broadcast.to(socket.id).emit('msg', '['+userData.gc+'/'+userData.uid+'] JUST CONNECTED');

    // send all user status in group
    let uArr1 = [];
    pyClients.forEach((item, i) => {
      let arr1 = {gc: pyClients[i].room, uid: pyClients[i].uuid};
      if (pyClients[i].room === userData.gc) uArr1.push(arr1);
    });
    socket.broadcast.to(socket.id).emit('msg', {response: 'user_status', data: uArr1}); // send status of all users in the channel
    console.log('[NEW] emitting_to => ['+userData.gc+'] data: '+JSON.stringify(uArr1)+'\n');
  });

  // SOCKET { MSG } PROCESSING
  socket.on('msg', (data) => {
    data.sid = socket.id;
    if (data.hasOwnProperty('action')) {
      admin_server_nsp.emit('msg', {socket_type: 'admin', socket_data: data}); // send message direct to the admin namespace
      switch (data.action) {
        case 'user_status': // get user status in specified room
           if (data.hasOwnProperty('gc')) {
             let t_gc = data.gc;
             let t_uid = data.uid;

             console.log("\nFRM: "+t_gc);
             console.log("FRM: "+socketGC);

             let logArr = [];
             let uArray = [];
             pyClients.forEach((item, i) => {
               let arr = {gc: pyClients[i].room, uid: pyClients[i].uuid};
               if (pyClients[i].room === t_gc) uArray.push(arr);
               logArr.push(arr);
             });
             socket.broadcast.to(t_gc).emit('msg', {response: 'user_status', data: uArray}); // send status of all users in the channel
             console.log('[SNT] emitting_to => ['+t_gc+'] data: '+JSON.stringify(uArray)+'\n');

             logArr.forEach((item, i) => console.log('[LOG] connected_user => ['+item.gc+'] data: '+JSON.stringify(item)));
           }
          break;

        case 'clients':
          let userChannel = data.cid;
          let userGroup = data.gc;
          let userID = data.uid;

          let uArray = [];
          pyClients.forEach((item, i) => {
            let arr = {gc: pyClients[i].room, uid: pyClients[i].uuid};
            if (pyClients[i].room === userGroup) uArray.push(arr);
          });

          let response = {user_status: uArray};
          python_server_nsp.emit(userChannel, response); // send status of all users in the channel
          console.log("[+] Client reached -> "+userGroup+"/"+userID);

          // LOG ALL USERS IN ROOM
          uArray.forEach((item, i) => console.log('[LOG] connected_user => ['+item.gc+'] data: '+JSON.stringify(item)));
          break;

        case 'disconnect':
          let uGroup = data.gc;
          let uID = data.uid;
          let arr = {
            disconnected_user: { uid: uID, gc: uGroup }
          };
          socket.broadcast.to(uGroup).emit('msg', arr); // send status of all users in the channel
          console.log('[SNT] emitting_to => ['+uGroup+'] data: User disconnected\n');
          break;

        default:
          break;
      }
    }
  });
  // -------------------------------------------------------------------------->
});
// ==========================================================================================================================================================================/\



function getKeyByValue(object, value) {
  return Object.keys(object).find(key => object[key] === value);
}


















// ===========================================================================================================================================================================>

server.listen(port, () => console.log(`Listening on port ${port}`));
