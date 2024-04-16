var print = console.log
class CreatorView {
  constructor(containerElement) {
    this.containerElement = containerElement;

    this.style = '';
    this.message = '';
    this.img = null;
    this.dynamo_list = null;

    this.cardImage = document.querySelector('#card-image');
    this.cardMessage = document.querySelector('#card-message');

    this.styleInput = document.querySelector('#card-style-input');
    // this.messageInput = document.querySelector('#card-message-input');

    // file input button
    this.imageUpload = document.querySelector('#image-upload');
    // "Upload Image" button
    // this.uploadButton = document.querySelector('#upload-button');
    this.uploadForm = document.querySelector('#upload-form');

    // Image that shows up on front end after uploading image
    this.uploadedImage = document.querySelector('#uploaded-image');
    this.form = document.querySelector('form');
    this.creatorView = document.querySelector('#creator-view');
    this.statusView = document.querySelector('#status-view');
    this.cardLink = document.querySelector('#card-link');

    // Bind methods.
    // this._onFileChange = this._onFileChange.bind(this);
    this._onFormChange = this._onFormChange.bind(this);
    this._onFormSubmit = this._onFormSubmit.bind(this);
    this._updateView = this._updateView.bind(this);

    this._fetchList();

    // Add event listeners.
    this.styleInput.addEventListener('change', this._onFormChange);
    // this.messageInput.addEventListener('keyup', this._onFormChange);
    // this.form.addEventListener('submit', this._onFormSubmit);
    this.uploadForm.addEventListener('submit', this._onFormSubmit);

    // this.imageUpload.addEventListener('change', this._onFileChange);

    this._updateView();

    this.containerElement.classList.remove('hidden');
  }

  async _fetchList() {

    const fetchOptions = {
      method: 'get',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
    };

    const retrieved_list = await fetch('/list', fetchOptions);

    const json = await retrieved_list.json();
    for( var i in json ){
      const option = document.createElement('option');
      option.value = json[i].Key['S'];
      option.innerHTML = json[i].Name['S'];
      this.styleInput.appendChild( option );
    }
  }

  _onFormChange() {
    this._updateView();
  }

    /**
   * Callback called when a "submit" button is pressed
   * @param {*} event
   */
  async _onFormSubmit(event) {
    // console.log(event.srcElement[1].files[0])
    event.preventDefault();

    const image_title = document.querySelector('#image-title');
    const uploaded_file = document.querySelector('#image-upload').files[0];
    // const url = URL.createObjectURL(file)
    // print(url)
    // let form = new FormData();
    // form.append('image_title', image_title.value);
    // form.append('file', file);
    // print(form.get('file'))

    function blobToBase64(blob) {
      return new Promise((resolve, _) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    }
    let b64_file = await blobToBase64(uploaded_file)
    b64_file = b64_file.split(',')[1];
    let form_obj = {
      image_title: image_title.value,
      filename: uploaded_file.name,
      file: b64_file
    }

    const fetchOptions = {
      method: 'post',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(form_obj)
    };

    const result = await fetch('/save', fetchOptions);
    const json = await result.json();


    this.creatorView.classList.add('hidden');
    this.cardLink.href = '/id/' + json.filename;
    this.statusView.classList.remove('hidden');
  }

  async _updateView() {
    const image_container = this.containerElement.querySelector('#image');
    const segmented_container = this.containerElement.querySelector('#segmented-image');
    const index = this.styleInput.selectedIndex;
    if(index === 0){
      image_container.src = "";
      segmented_container.src = "";
      return
    }
    // const image_name = this.styleInput[index].innerHTML;
    const dynamo_name = this.styleInput[index].value;

    const result = await fetch(`/get/${dynamo_name}`);
    const json = await result.json();

    let img_url_string = await fetch("data:image/png;base64," + json.image);
    img_url_string = await img_url_string.blob();

    let seg_url_string = await fetch("data:image/png;base64," + json.seg_image);
    seg_url_string = await seg_url_string.blob();

    let img_link = URL.createObjectURL(img_url_string)
    let seg_img_link = URL.createObjectURL(seg_url_string)

    image_container.src = img_link;
    segmented_container.src = seg_img_link;

  }
}
