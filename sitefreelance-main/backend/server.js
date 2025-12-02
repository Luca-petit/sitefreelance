require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Endpoint formulaire
app.post('/contact', async (req, res) => {
  const { name, email, title, message } = req.body;

  if(!name || !email || !title || !message){
    return res.status(400).json({ success: false, message: "Tous les champs sont requis" });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  try {
    await transporter.sendMail({
      from: email,
      to: process.env.EMAIL_TO,
      subject: title,
      text: `Nom: ${name}\nEmail: ${email}\nMessage: ${message}`
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Erreur lors de l’envoi du mail' });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Serveur démarré sur le port ${process.env.PORT || 3000} ✅`);
});
