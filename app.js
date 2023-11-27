const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();
const authentication = async (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_TOKEN");
      console.log(jwtToken);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
app.get("/states/", authentication, async (request, response) => {
  const getQuery = `SELECT * FROM state;`;
  response.send(await db.all(getQuery));
});
app.get("/states/:stateId/", authentication, async (request, response) => {
  const { stateId } = request.params;
  const getQuery = `SELECT * FROM state where state_id=${stateId};`;
  response.send(await db.get(getQuery));
});
app.post("/districts/", authentication, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addinDetails = `INSERT INTO district (
    district_name ,
    state_id ,
    cases,
    cured,
    active, 
    deaths    
  ) VALUES('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`;
  const toDb = await db.run(addinDetails);
  response.send("District Successfully Added");
});
app.get(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const getQuery = `SELECT * FROM district where district_id=${districtId};`;
    response.send(await db.get(getQuery));
  }
);
app.delete(
  "/districts/:districtId",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const getQuery = `DELETE  FROM district where district_id=${districtId}`;
    await db.get(getQuery);
    response.send("District Removed");
  }
);
app.put("/districts/:districtId", async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const putQuery = `UPDATE district SET district_name='${districtName}',
    state_id=${stateId},cases=${cases},cured=${cured},active=${active},deaths=${deaths};`;
  await db.run(putQuery);
  response.send("District Details Updated");
});
app.get(
  "/states/:stateId/stats/",
  authentication,
  async (request, response) => {
    const { stateId } = request.params;
    const getQuery = `SELECT
     sum(cases) as totalCases,
     sum(cured) as totalCured,
     sum(active) as totalActive,
     sum(deaths) as totalDeaths
     FROM 
     district WHERE state_id=${stateId};`;
    const stats = await db.get(getQuery);
    response.send(stats);
  }
);
module.exports = app;
