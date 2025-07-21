class NonogramInfinity extends BaseElement {
  #width = signal(this.getAttribute("width") || "5");
  #height = signal(this.getAttribute("height") || "5");
  #game;
  #state;
  #result;

  constructor() {
    super();
    this.#game = new Nonogram(this.#width.value, this.#height.value);
    this.#state = signal(Array(this.#game.bits.length).fill("0"));
    this.#result = computed((state) => {
      return state.value.join("") === this.#game.bits ? "You won!" : "";
    }, [this.#state]);
  }

  get state() {
    return this.#state;
  }

  get result() {
    return this.#result;
  }

  static styles = `
    table {
      line-height: 1;
    }

    thead th {
      white-space: pre-line;
      text-align: center;
      vertical-align: bottom;
      line-height: 1.7em;
    }

    tbody th {
      text-align: end;
      letter-spacing: 0.25em;
    }

    input[type="checkbox"] {
      width: 2em;
      height: 2em;
      margin: 0;
      padding: 0;
      vertical-align: middle;
    }

    output {
      display: block;
      font-family: monospace;
      text-align: center;
    }
  `;

  render() {
    const headers = this.#game.clues.cols.map(c => html`<th>${c.join("\n")}</th>`);
    const rows = this.#game.rows.map((r, rIdx) => {
      const columns = r.map((_, cIdx) => {
        const answerIdx = rIdx * this.#game.clues.cols.length + cIdx;
        const checked = this.#state.value[answerIdx] === "1";

        return html`
          <td>
            <input data-idx="${answerIdx}" type="checkbox" ${checked ? "checked" : ""} @click="toggle" />
          </td>
        `;
      });

      return html`
        <tr>
          <th>${this.#game.clues.rows[rIdx].join(" ")}</th>
          ${htmlRaw(columns.join(""))}
        </tr>
      `;
    });

    return html`
      <table>
        <thead>
          <tr>
            <th></th>
            ${htmlRaw(headers.join(""))}
          </tr>
        </thead>
        <tbody>
          ${htmlRaw(rows.join(""))}
        </tbody>
      </table>

      <!-- <output id="solution">${this.#game.bits.split("")}</output> -->
      <!-- <output id="state" :text="state"></output> -->
      <output id="result" :text="result"></output>
    `;
  }

  toggle(event) {
    const target = event.target;
    const idx = parseInt(target.dataset.idx, 10);
    const currentState = this.#state.value[idx];

    const newState = [...this.#state.value];
    newState[idx] = currentState === "1" ? "0" : "1";
    this.#state.value = newState;
  }
}

NonogramInfinity.define("nonogram-infinity")
