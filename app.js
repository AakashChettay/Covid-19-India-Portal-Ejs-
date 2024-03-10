const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
const app = express()

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401).send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'SankhyaYog', async (error, payload) => {
      if (error) {
        response.status(401).send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

app.use(express.json())

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({filename: dbPath, driver: sqlite3.Database})
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(-1)
  }
}
initializeDBAndServer()

//Login API
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const getUserDetailsQuery = `SELECT * FROM user WHERE username = ?;`
  const userData = await db.get(getUserDetailsQuery, [username])
  if (userData === undefined) {
    response.status(400).send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, userData.password)
    if (isPasswordMatched) {
      const payload = {username: username}
      const jwtToken = await jwt.sign(payload, 'SankhyaYog')
      response.send({jwtToken})
    } else {
      response.status(400).send('Invalid password')
    }
  }
})

//GET states API
app.get('/states/', authenticateToken, async (req, res) => {
  try {
    const getStatesQuery = `
      SELECT state_id AS stateId, state_name AS stateName, population
      FROM state;
    `
    const databaseResponse = await db.all(getStatesQuery)
    res.json(databaseResponse)
  } catch (err) {
    console.error(err.message)
    res.status(500).json({error: 'Internal Server Error'})
  }
})

//GET state by Id API
app.get('/states/:stateId', authenticateToken, async (req, res) => {
  const { stateId } = req.params;
  try {
    const getStateQuery = `
      SELECT state_id AS stateId, state_name AS stateName, population
      FROM state
      WHERE state_id = ?;
    `;
    const databaseResponse = await db.get(getStateQuery, [stateId]);
    res.json(databaseResponse);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

//Add district API
app.post('/districts', authenticateToken, async (request, response) => {
  const addingStateQuery = `
  INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
      VALUES (?, ?, ?, ?, ?, ?);
  `
  await db.run(addingStateQuery, [
    request.body.districtName,
    request.body.stateId,
    request.body.cases,
    request.body.cured,
    request.body.active,
    request.body.deaths,
  ])
  response.send('District Successfully Added')
})

//GET district by id API
app.get('/districts/:districtId', authenticateToken,  async (req, res) => {
  const { districtId } = req.params;
  try {
    const getDistrictQuery = `
      SELECT district_id AS districtId, district_name AS districtName, state_id AS stateId, cases, cured, active, deaths
      FROM district
      WHERE district_id = ?;
    `;
    const dbResponse = await db.get(getDistrictQuery, [districtId]);
    res.json(dbResponse);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Internal Server Error');
  }
});

// Delete district data by Id API
app.delete('/districts/:districtId', authenticateToken, async (req, res) => {
  const {districtId} = req.params
  try {
    const deleteDistrictQuery = `
      DELETE FROM district
      WHERE district_id = ?;
    `
    await db.run(deleteDistrictQuery, [districtId])
    res.send('District Removed')
  } catch (e) {
    console.error(e.message)
    res.status(500).send('Internal Server Error')
  }
})

// Update district data by ID API
app.put('/districts/:districtId', authenticateToken, async (req, res) => {
  const {districtId} = req.params
  const districtDetails = req.body
  const {districtName, stateId, cases, cured, active, deaths} = districtDetails
  try {
    const updateDistrictQuery = `
      UPDATE district
      SET district_name = ?, state_id = ?, cases = ?, cured = ?, active = ?, deaths = ?
      WHERE district_id = ?;
    `
    await db.run(updateDistrictQuery, [
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
      districtId,
    ])
    res.send('District Details Updated')
  } catch (err) {
    console.error(err.message)
    res.status(500).send('Internal Server Error')
  }
})

// Get Stats of a state by state id API
app.get('/states/:stateId/stats/', authenticateToken, async (req, res) => {
  const {stateId} = req.params
  try {
    const getStatsQuery = `
      SELECT SUM(cases) AS totalCases, SUM(cured) AS totalCured, SUM(active) AS totalActive, SUM(deaths) AS totalDeaths
      FROM district
      WHERE state_id = ?;
    `
    const dbResponse = await db.get(getStatsQuery, [stateId])
    res.json(dbResponse)
  } catch (err) {
    console.error(err.message)
    res.status(500).send('Internal Server Error')
  }
})

module.exports = app;