# Features (da Chanousel)

Elenco delle funzionalità dell'estensione Chrome **Chanousel**, da portare in Modernchan.
Chanousel è un feed verticale stile reel per i media dei thread e delle board di 4chan
(`boards.4chan.org`, `boards.4channel.org`).

## 1. Sorgenti dei media

- **Thread aperto**: raccoglie tutti i media (immagini, GIF, WebM, MP4) dalla pagina, senza duplicati (dedup per URL).
- **Board (Random)**: legge i media di *tutti* i thread della board tramite l'API pubblica di 4chan
  (`a.4cdn.org/{board}/threads.json` + `thread/{op}.json`), perché l'indice della board mostra solo OP e ultime risposte.
  - Richieste in parallelo (6 alla volta).
  - Cache del risultato per 5 minuti per riaperture rapide.
  - Indicatore di avanzamento durante il caricamento (`🎲 12/80`).
  - Se l'API non è raggiungibile, ripiega sui media presenti nella pagina.
- **Thread da API**: i thread raggiunti dalla card (o dal Random) vengono caricati per intero via API.
- Estensioni supportate: `jpg`, `jpeg`, `png`, `gif`, `webp`, `webm`, `mp4`. File eliminati ignorati.
- Per ogni media: URL, thumbnail, tipo (video/immagine), nome file originale, id del post, link al post.

## 2. Avvio

- Pulsante flottante **▶ Galleria (N)** con il numero di media trovati; compare solo se ce ne sono.
- Pulsante **🎲 Random** solo sulle pagine di board (non nei thread).
- Scorciatoia **`G`** per aprire la galleria (ignorata mentre si scrive in un campo di testo).
- Il feed parte dal **primo media visibile** nel viewport.
- I pulsanti si aggiornano da soli quando il thread si aggiorna con nuovi post (osservazione del DOM con debounce).

## 3. Viewer a tutto schermo

- Un media alla volta, a tutto schermo, sfondo nero, `object-fit: contain` (anche i file piccoli vengono ingranditi).
- Navigazione **verticale** stile reel con animazione di scorrimento:
  rotellina (con throttle), swipe touch (soglia 50px), frecce.
- Navigazione circolare: dopo l'ultimo si torna al primo.
- Precaricamento dell'immagine successiva.
- Gestione errori: messaggio "Impossibile caricare il file" e salto automatico al successivo se l'autoplay è attivo.
- Blocca lo scroll della pagina sottostante mentre è aperto.
- UI isolata (Shadow DOM) per non interferire con gli stili del sito.

## 4. Autoplay

- Attivo di default; pulsante ❚❚/▶ in alto a destra o `Spazio`.
- **Immagini**: restano a schermo per un intervallo configurabile (1–60 s, default 5 s), con barra di progresso animata in alto.
- **Video**: riprodotti fino alla fine, poi si passa al successivo; con autoplay fermo vanno in loop.
- Barra di progresso dei video basata sul tempo di riproduzione.
- Arrivato all'ultimo media su un thread, **ricontrolla la pagina** per includere i nuovi post, poi riparte da capo.
- L'intervallo scelto è **persistente** (`localStorage`).

## 5. Video

- Nessun controllo nativo: un **tap/click mette in pausa o riprende**.
- **Audio attivo di default**; se il browser blocca l'autoplay con audio, riparte automaticamente muto.
- Tasto `M` per attivare/disattivare l'audio (solo per la sessione, non persistente).
- Il media precedente viene fermato e scaricato (`src` rimosso) per liberare risorse.

## 6. Card del thread

- In basso, stile reel: badge con la board (`/g/`), titolo del thread (oggetto dell'OP, altrimenti `Thread #N`) e descrizione (commento dell'OP).
- La descrizione è troncata a 2 righe; un click la **espande** (scrollabile).
- Il commento HTML di 4chan viene convertito in testo semplice (con a capo).
- Click sul **titolo** → apre la galleria di quel thread (via API), partendo dal media corrente.
- Pulsante **← Back to random**: se si è entrati in un thread dal Random, riporta al feed casuale nella posizione precedente.

## 7. Random

- Mescola tutti i media della board con **Fisher-Yates**: probabilità uniforme per media, nessuna ripetizione finché la lista non si ripete.
- I media vengono dall'API, quindi non hanno un anchor nella pagina.

## 8. Azioni sul post

- `P`: chiude la galleria e **salta al post** del media corrente
  (hash `#pXXXX` nel thread corrente, oppure navigazione a `/{board}/thread/{op}#p{no}` per i media del Random).

## 9. Scorciatoie da tastiera

| Tasto                     | Azione                              |
|---------------------------|-------------------------------------|
| `G`                       | apri la galleria                    |
| `↓` / `→` / rotellina giù | successivo                          |
| `↑` / `←` / rotellina su  | precedente                          |
| `Spazio`                  | avvia / ferma l'autoplay            |
| `-` / `+` (`=`)           | secondi per immagine (1–60)         |
| `M`                       | audio dei video                     |
| `F`                       | schermo intero                      |
| `P`                       | chiudi e vai al post                |
| `Home` / `End`            | primo / ultimo                      |
| `Esc`                     | chiudi                              |

- Listener in fase di *capture* con `stopImmediatePropagation`, così le scorciatoie di 4chan e dei video nativi non interferiscono.
- Ignorate con Ctrl/Cmd/Alt premuti.

## 10. Altre

- **Schermo intero** (`F`) con uscita automatica alla chiusura.
- Nessun permesso richiesto all'estensione.
- Persistenza minimale: solo l'intervallo delle immagini, con prefisso `chanousel:`; gli errori di storage sono ignorati.
- UI e testi in italiano.
