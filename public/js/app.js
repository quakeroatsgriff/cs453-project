class App {
  constructor() {
    const urlPathString = window.location.pathname;
    const parts = urlPathString.split('/');
    if (parts.length > 2 && parts[1] === 'id') {
      const cardId = parts[2];
      this._showCardView(cardId);
    } else {
      this._showCreateView();
    }
  }

  _showCreateView() {
    const viewContainer = document.querySelector('#creator-view');
    const creatorView = new CreatorView(viewContainer);
  }

  _showCardView(cardId) {
    const viewContainer = document.querySelector('#card-container');
    const cardView = new CardView(viewContainer, cardId);
  }
}
