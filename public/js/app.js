class App {
  constructor() {
    const urlPathString = window.location.pathname;
    const parts = urlPathString.split('/');
    // Find the filename from the URL and show them in their own view.
    if (parts.length > 2 && parts[1] === 'id') {
      const filename = parts[2];
      this._showCardView(filename);
    } else {
      this._showCreateView();
    }
  }

  _showCreateView() {
    const viewContainer = document.querySelector('#creator-view');
    const creatorView = new CreatorView(viewContainer);
  }

  _showCardView(filename) {
    const viewContainer = document.querySelector('#card-container');
    const cardView = new CardView(viewContainer, filename);
  }
}
