class CreatorView {
  constructor(containerElement) {
    this.containerElement = containerElement;

    // Dropdown menu for selecting images from the S3 database
    this.styleInput = document.querySelector('#card-style-input');
    // Form for "Upload and Segment Image" button and image upload button
    this.uploadForm = document.querySelector('#upload-form');
    // Image that shows up on front end after uploading image
    this.uploadedImage = document.querySelector('#uploaded-image');
    // The view that has the dropdown menu, browse button and upload and segment image button
    this.creatorView = document.querySelector('#creator-view');
    // The view that says "segmentation complete! :)" with the links to go back
    // or view the original and segmented images.
    this.statusView = document.querySelector('#status-view');
    // Used to bring you to the original and segmented images after upload/segment.
    this.cardLink = document.querySelector('#card-link');

    // Bind methods.
    this._onFormChange = this._onFormChange.bind(this);
    this._onFormSubmit = this._onFormSubmit.bind(this);
    this._updateView = this._updateView.bind(this);

    this._fetchList();

    // Add event listeners.
    this.styleInput.addEventListener('change', this._onFormChange);
    this.uploadForm.addEventListener('submit', this._onFormSubmit);

    this._updateView();

    this.containerElement.classList.remove('hidden');
  }

  /**
   * Retrives the list of image names from DynamoDB and populates the dropdown menu
   * on the main page.
   */
  async _fetchList() {

    const fetchOptions = {
      method: 'get',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
    };
    // Do the GET request to get the list of objects from DynamoDB.
    const retrieved_list = await fetch('/list', fetchOptions);

    const json = await retrieved_list.json();
    // Iterate through each object and create an "option" in the dropdown menu.
    for( var i in json ){
      const option = document.createElement('option');
      // Key is filename
      option.value = json[i].Key['S'];
      // This is the image name
      option.innerHTML = json[i].Name['S'];
      this.styleInput.appendChild( option );
    }
  }

  /**
   * When an option from the dropdown menu is selected, update the view of the images
   * from S3.
   */
  _onFormChange() {
    this._updateView();
  }

    /**
   * Callback called when the "Upload and Segment" button is pressed
   * @param {*} event
   */
  async _onFormSubmit(event) {
    event.preventDefault();

    // Retrieve HTML elements that were filled out.
    const image_title = document.querySelector('#image-title');
    const uploaded_file = document.querySelector('#image-upload').files[0];

    /**
     * Create a promise for reading in the uploaded, not encoded image. This converts
     * it to base64 encoding.
     * @param {*} blob
     * @returns
     */
    function blob_to_b64( blob ) {
      return new Promise( (resolve, _) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    }
    let b64_file = await blob_to_b64(uploaded_file)
    // Strip off the data URL part of the string, only get the base64 part.
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

    // Upload the image to the server back-end for segmenting.
    const result = await fetch('/save', fetchOptions);
    if(result.status === 401)
    {
      window.alert("Please sign in!");
      return;
    }
    const json = await result.json();

    // Inform the client the segmentation and upload is successful. Change the view
    // to the status view (ask what to do next).
    this.creatorView.classList.add('hidden');
    // Ready the view link to view the original and segmented images.
    this.cardLink.href = '/id/' + json.filename;
    this.statusView.classList.remove('hidden');
  }

  /**
   * Called when loading the container (web page). Gets the image elements from
   * the HTML and fills them with image data when making a change in the dropdown menu.
   */
  async _updateView() {
    // Get the img and label elements from their HTML id tags in order to fill them.
    const image_container = this.containerElement.querySelector('#image');
    const segmented_container = this.containerElement.querySelector('#segmented-image');
    // Get the choice of the user in the dropdown menu
    const index = this.styleInput.selectedIndex;
    // If the choice is the default "select and image" choice, clear the current
    // images (if any) and immediately return.
    if(index === 0){
      image_container.src = "";
      segmented_container.src = "";
      return
    }

    // image name
    const dynamo_name = this.styleInput[index].value;

    // Back-end GET request to get the image data from S3
    const result = await fetch(`/get/${dynamo_name}`);
    const json = await result.json();

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
    segmented_container.src = seg_img_link;
  }
}
