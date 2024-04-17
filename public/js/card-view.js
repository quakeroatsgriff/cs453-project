/**
 * Class to hold original and segmented images with a user-submitted image name.
 */
class CardView {
  // ContainerElement holds the image sections.
  constructor(containerElement, filename) {
    this.containerElement = containerElement;
    // filename
    this.filename = filename;
    this._loadCard();
    this._checkLoggedIn();
  }

  /**
   * Called when loading the container (web page). Gets the image elements from
   * the HTML and fills them with image data.
   */
  async _loadCard() {
    const result = await fetch(`/get/${this.filename}`);
    const json = await result.json();

    // Get the img and label elements from their HTML id tags in order to fill them.
    const image_container = this.containerElement.querySelector('#image');
    const seg_image_container = this.containerElement.querySelector('#segmented-image');
    const image_title_container = this.containerElement.querySelector('#image-name');

    image_title_container.textContent = json.dynamo_name;

    // Create URL from base64 image data and the data type header
    // Then blobify the string
    let img_url_string = await fetch("data:image/png;base64," + json.image);
    img_url_string = await img_url_string.blob();

    let seg_url_string = await fetch("data:image/png;base64," + json.seg_image);
    seg_url_string = await seg_url_string.blob();

    // Make a usable image URL
    let img_link = URL.createObjectURL(img_url_string)
    let seg_img_link = URL.createObjectURL(seg_url_string)

    // Fill the img element src with the URLs
    image_container.src = img_link;
    seg_image_container.src = seg_img_link;

    // Swap the view so that you see the "segmentation complete!" page.
    this.containerElement.classList.remove('hidden');
  }

  async _checkLoggedIn(){
    const fetchOptions = {
      method: 'get',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
    };
    const result = await fetch('/loggedin', fetchOptions);
    if(result.status === 401)
    {
      return;
    }
    const loginButton = document.querySelector('#login');
    loginButton.innerHTML = "Home";
    loginButton.style.href = '/';
  }
}
