class CardView {
  constructor(containerElement, cardId) {
    this.containerElement = containerElement;
    this.cardId = cardId;
    this._loadCard();
  }

  async _loadCard() {
    console.log(this.cardId);
    const result = await fetch(`/get/${this.cardId}`);
    const json = await result.json();
    const cardImgContainer = this.containerElement.querySelector('#card-image');
    cardImgContainer.classList.add(json.style);
    const cardMessage = this.containerElement.querySelector('#card-message');
    cardMessage.textContent = json.message;

    this.containerElement.classList.remove('hidden');
  }
}
