// ECLIPSE APP CODE

// INITIALIZING Server
const express = require('express')
const { QuickDB } = require("quick.db");
const path = require('path')
const emails = new QuickDB({ filePath: path.join(__dirname, "/emails.sqlite") });
const users = new QuickDB({ filePath: path.join(__dirname, "/users.sqlite") });
const messages = new QuickDB({ filePath: path.join(__dirname, "/messages.sqlite") });
const { parse, stringify, toJSON, fromJSON } = require('flatted');
const cors = require('cors')

const app = express()
app.use(cors())
app.set('trust proxy', 1) // trust first proxy
const session = require('express-session')
var cookieParser = require('cookie-parser')
app.use(cookieParser())

app.use(session({
  secret: process.env.secret,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true, maxAge: null }
}))
const randomString = require('random-string')

app.set('view engine', 'ejs')
var device = require('express-device');

app.set('view engine', 'ejs');
app.set('view options', { layout: false });
app.set('views', __dirname + '/views');

app.use(device.capture());

const bcrypt = require('bcrypt');

const bodyParser = require('body-parser');
app.use(bodyParser.json());


app.get('/api/me', (req, res) => {
  if (!req.session.user) {
    res.send(JSON.stringify({}))
  } else {
    res.send(res.session.user)
  }
})

async function updateUsers() {
  const usrs = await users.getAll()
  const allUsers = Object.values(usrs)
  const filteredUsers = allUsers.filter(u => u.avatar)

  filteredUsers.forEach(async u => {
    let newUsr = u;
    if (u.avatar == "https://i.ibb.co/414YQvv/image.png") {
      newUsr.avatar == "https://i.ibb.co/3N90ysR/image.png"
    }
    if (!u.status) {
      newUsr.status = ""
    }
    if (!u.onlineAt) {
      newUsr.onlineAt = 0

    }
    await users.set(newUsr.username, newUsr)

  })
}

updateUsers()

app.get('/me/allMsgs', async (req, res) => {
  if (!req.session.user) {
    console.log('fail')
    res.send(JSON.stringify({ error: true }))
  } else {
    console.log('almsot sucess')
    const allMessages = Object.keys(await messages.getAll())
    const filteredMsgs = allMessages.filter(n => n.includes(req.session.user.username))

    let msgArray = []
    for (n in filteredMsgs) {
      const msg = await messages.get(n)

      msgArray.push(msg)
    }
    if (msgArray[msgArray.length - 1].username == req.session.user.username) return res.send(JSON.stringify({ error: true }))
    console.log('sendoff!')
    res.send(msgArray)
  }
})

app.get('/logout', async (req, res) => {
  if (!req.session.user) {
    res.redirect('/')
  } else {
    delete req.session.user
    res.redirect('/')
  }
})



async function deleteUser(user) {
  await emails.delete(user.email)
  await users.delete(user.username)
  console.log('deleted')
}

async function addBanner(user, url) {
  const userObject = await users.get(user)

  if (userObject == null) return
  if (!url.includes('http')) return
  if (!url.includes('.')) return
  userObject.banner = url
  await users.set(user, userObject)
  console.log('added banner')
}

async function editUser(username, user) {
  await users.set(username, user)
  console.log('edited user')
}


function checkForMissingData(obj) {
  const missingList = new Array()
  const objParams = Object.getOwnPropertyNames(obj);
  objParams.forEach(param => {
    if (param == "contacts") {
      return
    }
    if (param == "nickname") {
      return
    }
    if (param == "id") {
      return
    }
    if (!obj[param]) {
      missingList.push(param)
    }
  });

  return {
    missing: missingList,
    isMissing: missingList.length > 1 ? true : false
  }
}


app.get('/', (req, res) => {
  if (!req.session.user) {
    res.sendFile(__dirname + `/views/index.html`)
  } else {
    res.redirect('/app')
  }
})


app.post('/login', async (req, res) => {
  const user = req.body
  if (await emails.get(user.email) == null) {
    if (await users.get(user.username) == null) {
      const errorJSON = {
        message: "User doesn't exist! Try signing up or try a different email."
      }
      res.send(JSON.stringify(errorJSON))
    } else {
      if (checkForMissingData(user).isMissing == true) {
        const errorJSON = {
          message: "You are missing the following parameters: " + checkForMissingData(user).missing.join(", ")
        }
        res.send(JSON.stringify(errorJSON))
      } else {
        const userrq = await users.get(user.username)
        const finalUser = await emails.get(userrq.email)
        bcrypt.compare(user.password, finalUser.hashedPassword, (err, isMatch) => {
          if (err) {
            // Handle error
            console.error('Error comparing passwords:', err);
            const errorJSON = {
              message: "Error comparing passwords! Try again later."
            }
            res.send(JSON.stringify(errorJSON))
          } else if (isMatch) {
            req.session.user = finalUser

            res.send(JSON.stringify({ finished: true })).status(200)
          } else {
            const errorJSON = {
              message: "Password is incorrect."
            }
            res.send(JSON.stringify(errorJSON))
          }
        });
      }
    }
  } else {
    if (await emails.get(user.email) !== null) {
      if (checkForMissingData(user).isMissing == true) {
        const errorJSON = {
          message: "You are missing the following parameters: " + checkForMissingData(user).missing.join(", ")
        }
        res.send(JSON.stringify(errorJSON))
      } else {
        const finalUser = await emails.get(user.email)
        bcrypt.compare(user.password, finalUser.hashedPassword, (err, isMatch) => {
          if (err) {
            // Handle error
            console.error('Error comparing passwords:', err);
            const errorJSON = {
              message: "Error comparing passwords! Try again later."
            }
            res.send(JSON.stringify(errorJSON))
          } else if (isMatch) {
            req.session.user = finalUser

            res.send(JSON.stringify({ finished: true })).status(200)
          } else {
            const errorJSON = {
              message: "Password is incorrect."
            }
            res.send(JSON.stringify(errorJSON))
          }
        });
      }
    } else {
      const errorJSON = {
        message: "Account does not exist! try signing up."
      }
      res.send(JSON.stringify(errorJSON))
    }
  }
})

app.post('/signup', async (req, res) => {
  const user = req.body
  if (await emails.get(user.email) !== null) {
    const errorJSON = {
      message: "Email already exists for a user! Try signing up with a different email."
    }
    res.send(JSON.stringify(errorJSON))
  } else {
    if (checkForMissingData(user).isMissing == true) {
      const errorJSON = {
        message: "You are missing the following parameters: " + checkForMissingData(user).missing.join(", ")
      }
      res.send(JSON.stringify(errorJSON))
    } else {

      bcrypt.hash(user.password, 10, async (err, hash) => {
        if (err) {
          // Handle error
          console.error('Error hashing password:', err);
        } else {
          // Store the hash in your database or use it as needed
          user.hashedPassword = hash
          delete user.password
          user.contacts = []
          user.status = ""
          user.lastOnline = Date.now()

          const finalUser = user

          await users.set(finalUser.username, finalUser)
          await emails.set(user.email, finalUser)
          req.session.user = finalUser
          res.send(JSON.stringify({ finished: true })).status(200)

        }
      });
    }
  }
})



app.get('/login', async (req, res) => {
  if (req.session.user) {
    res.redirect('/app')
  } else {
    if (req.cookies.accountKey) {
      const userz = Object.values(await users.getAll())
      const allUsers = userz.filter(u => u.contacts !== undefined)
      allUsers.forEach(user => {
        if (user.accountKeys && user.accountKeys.includes(req.cookies.accountKey)) {
          req.session.user = user
          res.redirect('/app')
        }
      })
    } else {
      res.sendFile(__dirname + '/views/login.html')
    }
  }
})

app.get('/me/allMsgs', async (req, res) => {
  if (!req.session.user) {
    console.log('fail')
    res.send(JSON.stringify({ error: true }))
  } else {
    console.log('almsot sucess')
    const allMessages = Object.keys(await messages.getAll())
    const filteredMsgs = allMessages.filter(n => n.includes(req.session.user.username))

    let msgArray = []
    for (n in filteredMsgs) {
      const msg = await messages.get(n)

      msgArray.push(msg)
    }
    if (msgArray[msgArray.length - 1].username == req.session.user.username) return res.send(JSON.stringify({ error: true }))
    console.log('sendoff!')
    res.send(msgArray)
  }
})

app.get('/logout', async (req, res) => {
  if (!req.session.user) {
    res.redirect('/')
  } else {
    delete req.session.user
    res.redirect('/')
  }
})


app.get('/app', async (req, res) => {
  if (!req.session.user) {
    res.redirect('/login')
  } else {
    var device = require('device');
    var mydevice = device(req.headers['user-agent']);
    let is_desktop;
    if (mydevice.is('desktop')) {
      is_desktop = true
    } else {
      is_desktop = false
    }
    const msgs = await messages.getAll()
    const userr = await emails.get(req.session.user.email)
    userr.lastOnline = Date.now()
    await emails.set(userr.email, userr)
    await users.set(userr.username, userr)
    
    const allServers = Object.values(await servers.getAll()).filter(s => s.members)
    let userServers;
    if (allServers == null || allServers == undefined) {
      userServers = []
    } else {
      userServers = allServers.filter(s => s.members.includes(userr.username) || s.creator == userr.username)
    }
    res.render('app', { me: userr, messages: msgs, is_desktop, servers: userServers, getScore: getScore })
  }
})

app.get('/user/:username', async (req, res) => {
  const userr = await emails.get(req.session.user.email)
  res.render('soon', { me: userr })
})

app.get('/messages/:username', async (req, res) => {
  if (!req.session.user) {
    res.redirect('/login')
  } else {
    var device = require('device');
    var mydevice = device(req.headers['user-agent']);
    let is_desktop;
    if (mydevice.is('desktop')) {
      is_desktop = true
    } else {
      is_desktop = false
    }
    const member = new Array(req.session.user.username, req.params.username).sort().join('_')
    const messageList = await messages.get(member)
    const me = await emails.get(req.session.user.email)
    
    me.lastOnline = Date.now()
    await emails.set(me.email, userr)
    await users.set(me.username, userr)
    
    const user = await users.get(req.params.username)
    const msgs = await messages.getAll()
    res.render('messages', { me: me, messages: messageList, user: user, is_desktop, allMessages: msgs, getScore: async (usr) => await getScore(usr) })
  }
})

app.get('/api/@me/setOnline', async (req, res) => {
      const userr = await emails.get(req.session.user.email)

    userr.lastOnline = Date.now()
    await emails.set(userr.email, userr)
    await users.set(userr.username, userr)
    res.status(200).send('we good')
})


app.get('/:username/getAllMessageGroups', async (req, res) => {
  const user = await users.get(req.params.username)

  const allMessages = await messages.getAll()
  const scMessages = Object.keys(allMessages).filter(k => k.includes(user.username) && k.includes('_'))
  let allMsgs = 0
  for (msg of scMessages) {
    const msgList = await messages.get(msg)
    const updt = Object.values(msgList)
    for (msgg of updt) {
      if (msgg.username == req.params.username) {
        allMsgs = allMsgs + 1
      }
    }

  }
  res.send(JSON.stringify(allMsgs * 100))
});

app.get('/getMessages/:id', async (req, res) => {
  const messageList = await messages.get(req.params.id)
  res.send(JSON.stringify(messageList))
})

app.post('/messages/:id/send', async (req, res) => {
  const messageList = await messages.get(req.params.id)
  messageList.push(req.body)
  await messages.set(req.params.id, messageList)
  res.send(JSON.stringify({ worked: true }))
})



app.get('/servers', async (req, res) => {
  const userr = await emails.get(req.session.user.email)
  res.render('soon', { me: userr })
})

app.get('/api', async (req, res) => {
  const userr = await emails.get(req.session.user.email)
  res.render('soon', { me: userr })
})

app.get('/about', async (req, res) => {
  const userr = await emails.get(req.session.user.email)
  res.render('soon', { me: userr })
})


app.get('/user/:username/addContact/:contact', async function(req, res) {
  if (!req.session.user) {
    res.send(JSON.stringify({ error: "Must be logged in to add a contact." }))
  } else {

    const apiUser = await users.get(req.params.contact)
    if (apiUser === null) {
      return res.send(JSON.stringify({ error: "User does not exist!" }))
    }
    const me = await users.get(req.params.username)
    const meFilter = me.contacts.filter(c => c.username == apiUser.username)
    const apiFilter = apiUser.contacts.filter(c => c.username == me.username)
    if (me.username == apiUser.username) {
      return res.send(JSON.stringify({ error: "You cant add yourself to  a convo, silly!" }))
    }
    if (apiFilter.length > 0 || meFilter.length > 0) {
      return res.send(JSON.stringify({ error: "User is already in a convo with you." }))
    }

    const newAPIcontact = apiUser.contacts
    newAPIcontact.push({
      avatar: me.avatar,
      username: me.username
    })
    apiUser.contacts = newAPIcontact
    const newContact = me.contacts
    newContact.push({
      avatar: apiUser.avatar,
      username: apiUser.username
    })
    me.contacts = newContact

    await users.set(me.username, me)
    await emails.set(me.email, me)
    await users.set(apiUser.username, apiUser)

    await emails.set(apiUser.email, apiUser)
    const messageName = [apiUser.username, me.username].sort().join('_')
    await messages.set(messageName, [])
    res.send(JSON.stringify({ allGood: true }))
  }
})

app.get('/users/:user', async function(req, res) {
  if (!req.session.user) res.redirect('/login')
  const user = await users.get(req.params.user)
  const me = await users.get(req.session.user.username)
  if (user == null) return res.send('user doesn\'t exist! <a href="/app">go home</a>')

  res.render('user', { me, user })
})



app.listen(3000, () => {
  console.log('started')
}) 


module.exports = app;

