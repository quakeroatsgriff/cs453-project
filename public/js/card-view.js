class CardView {
  constructor(containerElement, filename) {
    this.containerElement = containerElement;
    // filename
    this.filename = filename;
    this._loadCard();
  }

  async _loadCard() {
    const result = await fetch(`/get/${this.filename}`);
    const json = await result.json();

    const image_container = this.containerElement.querySelector('#image');
    const seg_image_container = this.containerElement.querySelector('#segmented-image');
    const image_title_container = this.containerElement.querySelector('#image-name');

    image_title_container.textContent = json.dynamo_name;
    let img_url_string = await fetch("data:image/png;base64," + json.image);
    img_url_string = await img_url_string.blob();

    let seg_url_string = await fetch("data:image/png;base64," + json.seg_image);
    seg_url_string = await seg_url_string.blob();

    let img_link = URL.createObjectURL(img_url_string)
    let seg_img_link = URL.createObjectURL(seg_url_string)

    image_container.src = img_link;
    seg_image_container.src = seg_img_link;


    this.containerElement.classList.remove('hidden');
  }
}
