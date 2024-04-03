class CreatorView {
  constructor(containerElement) {
    this.containerElement = containerElement;

    this.style = '';
    this.message = '';

    this.cardImage = document.querySelector('#card-image');
    this.cardMessage = document.querySelector('#card-message');

    this.styleInput = document.querySelector('#card-style-input');
    this.messageInput = document.querySelector('#card-message-input');
    this.form = document.querySelector('form');
    this.creatorView = document.querySelector('#creator-view');
    this.statusView = document.querySelector('#status-view');
    this.cardLink = document.querySelector('#card-link');

    // Bind methods.
    this._onFormChange = this._onFormChange.bind(this);
    this._onFormSubmit = this._onFormSubmit.bind(this);
    this._saveValuesFromInput = this._saveValuesFromInput.bind(this);
    this._updateView = this._updateView.bind(this);

    // Add event listeners.
    this.styleInput.addEventListener('change', this._onFormChange);
    this.messageInput.addEventListener('keyup', this._onFormChange);
    this.form.addEventListener('submit', this._onFormSubmit);

    this._saveValuesFromInput();
    this._updateView();
    
    this.containerElement.classList.remove('hidden');
  }

  _onFormChange() {
    this._saveValuesFromInput();
    this._updateView();
  }

  async _onFormSubmit(event) {
    event.preventDefault();

    this._saveValuesFromInput();

    const params = {
      style: this.style,
      message: this.message
    }
    const fetchOptions = {
      method: 'post',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    };
    const result = await fetch('/save', fetchOptions);
    const json = await result.json();

    this.creatorView.classList.add('hidden');
    this.cardLink.href = '/id/' + json.cardId;
    this.statusView.classList.remove('hidden');
  }

  _saveValuesFromInput() {
    // Save style.
    const styleOptions = this.styleInput.options;
    const index = this.styleInput.selectedIndex;
    this.style = styleOptions[index].value;

    // Save message.
    this.message = this.messageInput.value;
  }

  _updateView() {
    this.cardImage.className = this.style;
    this.cardMessage.textContent = this.message;
  }
}
