# Esercizio digitale — "Mappa la tua Brigata"

Speech Mandarino per Rossato Group — evento formativo rete rivenditori

## Contesto

Esercizio live durante uno speech di 25 minuti su AI agentica in azienda, rivolto a installatori/rivenditori Rossato Store (target non tecnico). L'esercizio è la dimostrazione pratica del concetto centrale dello speech: la differenza tra un chatbot reattivo generico e un sistema che dà un giudizio su misura basato sul contesto specifico di chi lo usa.

Accesso: QR code proiettato in sala → apertura su smartphone dei partecipanti. Durata prevista in sala: \~6 minuti totali (compilazione \+ elaborazione \+ lettura).

## Flow (5 schermate)

### 1\. Registrazione

Campi:

- Nome (testo, obbligatorio)  
- Cognome (testo, obbligatorio)  
- Email (testo, obbligatorio, validazione formato email)  
- Azienda / Punto vendita (testo, obbligatorio)

CTA: "Inizia"

### 2\. Intro

Contenuto statico, 1 riga per ruolo, richiama la metafora già vista in sala:

- **Cuoco di linea** — esegue, ripete, non decide  
- **Sous-chef** — controlla, verifica, segnala le anomalie  
- **Chef** — decide, valida, si prende la responsabilità finale

CTA: "Continua"

### 3\. Le 3 domande

Testo libero, campo breve (max \~150 caratteri ciascuno), una domanda per volta o tutte insieme in scroll (preferenza UX da definire in build, non bloccante):

1. **Cuoco di linea** → "Un'attività ripetitiva che fai (o fanno i tuoi collaboratori) ogni giorno o quasi"  
2. **Sous-chef** → "Un controllo che fai sempre prima di consegnare o vendere qualcosa"  
3. **Chef** → "Una decisione che non deleghi mai a nessuno"

Validazione: nessun campo può restare vuoto. Non c'è validazione di "qualità" del contenuto lato form — la gestione delle risposte vaghe è demandata al prompt AI (vedi sotto), non bloccata a livello di UI. L'obiettivo è che nessuno si areni in sala per colpa di un campo obbligatorio troppo rigido.

CTA: "Invia"

### 4\. Stato di elaborazione

Messaggio breve mentre parte la chiamata AI, es.: "Stiamo leggendo le tue risposte..." Durata attesa: pochi secondi (chiamata AI singola, non streaming necessario ma preferibile se la latenza percepita è alta in sala con tanti utenti simultanei).

Gestione errore (timeout/fallimento chiamata AI): messaggio di scuse breve \+ pulsante "Riprova", nessuna perdita dei dati già inseriti.

### 5\. La Pillola

Output generato dal modello, mostrato sullo schermo del partecipante.

- Lunghezza: 3-4 righe massimo  
- Tono: semplice, diretto, non da manuale  
- Deve nominare esplicitamente qualcosa che la persona ha scritto (non un consiglio generico intercambiabile tra due partecipanti)  
- Contenuto: riflessione sul tenere sotto controllo le attività ripetitive in azienda, per capire cosa si potrebbe automatizzare, con l'obiettivo di risparmiare tempo e denaro  
- Nessuna CTA aggiuntiva in questa schermata (confermato: niente "parla con Mandarino" qui — il follow-up commerciale avviene dopo l'evento via email, fuori da questo tool)

## Data model

Un record per ogni submission:

{

  "id": "uuid",

  "timestamp": "ISO 8601",

  "nome": "string",

  "cognome": "string",

  "email": "string",

  "azienda": "string",

  "risposta\_cuoco\_di\_linea": "string",

  "risposta\_sous\_chef": "string",

  "risposta\_chef": "string",

  "pillola\_generata": "string"

}

Privacy: i dati (comprese le 3 risposte e la pillola generata) sono privati al singolo partecipante durante l'evento — non esiste alcuna vista pubblica o proiettata dei contenuti. Il presenter (Emanuele) ha visibilità solo su un contatore aggregato di quante submission sono arrivate, per gestire i tempi in sala — mai sul contenuto delle risposte.

Export: tutti i record devono essere esportabili (CSV o equivalente) a fine evento, per il follow-up commerciale post-evento (fuori scope di questo tool: la generazione del consiglio ad hoc via email avviene in una fase successiva, separata).

## Vista Presenter (solo Emanuele)

Schermata separata, non proiettata pubblicamente, protetta da un accesso semplice (es. un link/PIN che solo Emanuele ha):

- Contatore live: "X risposte ricevute"  
- Pulsante di export dei dati raccolti

## Prompt AI per la generazione della "Pillola"

Obiettivo del prompt: dato il set di 3 risposte di un partecipante, generare una riflessione breve e personalizzata sul tenere sotto controllo le attività ripetitive per capire cosa automatizzare, risparmiando tempo e denaro.

Requisiti del prompt:

- Deve citare/riprendere almeno un elemento concreto tra quelli scritti dall'utente (non deve essere intercambiabile tra due risposte diverse)  
- Deve restare a 3-4 righe, linguaggio semplicissimo, zero gergo tecnico (target: installatori e titolari di negozio, non addetti ai lavori AI)  
- Deve gestire correttamente il caso di risposte vaghe o minime (es. "niente di particolare", "boh"): in questo caso il modello non deve bloccare o chiedere di riscrivere, ma generare comunque una pillola riflessiva che parte dal concetto generale (tenere traccia delle attività ripetitive quotidiane per capire cosa vale la pena automatizzare) invece di forzare un riferimento specifico che non esiste  
- Non deve mai promettere risultati specifici, numeri o percentuali non verificabili  
- Non deve menzionare Mandarino, vendite, o essere in alcun modo una CTA commerciale — è una riflessione, il follow-up commerciale è un processo separato e successivo

Bozza di system prompt (da rifinire in fase di build):

Sei un assistente che aiuta piccoli imprenditori e installatori a riflettere

su quanto delle loro attività quotidiane è ripetitivo e potenzialmente

automatizzabile.

Riceverai 3 risposte di un partecipante a un esercizio in un evento formativo:

1\. Un'attività ripetitiva che fa lui o i suoi collaboratori

2\. Un controllo che fa sempre prima di consegnare o vendere

3\. Una decisione che non delega mai a nessuno

Genera una riflessione di massimo 4 righe che:

\- Riprenda in modo naturale almeno un elemento specifico tra quelli scritti

  (se le risposte sono vaghe o generiche, non forzare un riferimento

  specifico: genera comunque una riflessione utile partendo dal concetto

  generale)

\- Faccia notare la differenza tra ciò che è ripetitivo (potenzialmente

  automatizzabile) e ciò che richiede giudizio umano (non automatizzabile)

\- Chiuda con uno spunto di riflessione sul tempo o denaro che si potrebbe

  risparmiare tenendo sotto controllo le attività ripetitive

\- Non usi gergo tecnico, non nomini strumenti specifici, non faccia promesse

  quantificate

\- Non menzioni aziende, marchi, o inviti a contattare qualcuno

Rispondi solo con il testo della riflessione, nessun preambolo.

## Stati da gestire in build (checklist)

- [ ] Form registrazione con validazione base  
- [ ] Persistenza dei dati (submission \+ pillola generata)  
- [ ] Chiamata AI con gestione timeout/errore e retry  
- [ ] Vista presenter separata con contatore \+ export  
- [ ] Nessuna vista pubblica/proiettata dei contenuti  
- [ ] Ottimizzato per uso simultaneo da smartphone (decine di utenti in parallelo durante l'evento)

## Note operative per l'evento (non bloccanti, ma da considerare in build)

**Carico simultaneo**: in sala ci saranno potenzialmente 40-50 persone che inviano le risposte nello stesso minuto (subito dopo il "via" dato da Emanuele). Le chiamate AI per generare la pillola devono reggere richieste in parallelo senza incastrarsi o mettere gli utenti in coda invisibile.

**Rete debole in sala**: eventi con molti dispositivi connessi alla stessa wifi spesso hanno connessione instabile. Prevedere un fallback per il caso in cui la chiamata AI fallisca o vada in timeout ripetuto: ad esempio, invece di lasciare l'utente bloccato sullo stato di caricamento, offrire un messaggio tipo "la tua pillola arriverà via email" con invio asincrono successivo, oltre al semplice pulsante "Riprova" già previsto.  
