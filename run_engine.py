import os
import cv2
import numpy as np
import argparse
import onnxruntime as ort
import numpy as np
from PIL import Image
from io import BytesIO
from copy import deepcopy
from dotenv import load_dotenv
import boto3
import base64
import json

def parse_option():
    parser = argparse.ArgumentParser('argument for segmentation')

    # the given mobile sam model
    parser.add_argument('--custom_encoder', type=str, default="./onnx/encoder.onnx")
    parser.add_argument('--custom_decoder', type=str, default="./onnx/decoder.onnx")
    parser.add_argument('--key', type=str, help="S3 key to query")

    args = parser.parse_args()
    return args

class CustomMSAM():
    def __init__( self, encoder_path: str, decoder_path: str ) -> None:
        # Load onnx encoder and decoder
        self.encoder = ort.InferenceSession( encoder_path, providers=['CUDAExecutionProvider', 'CPUExecutionProvider'] )
        self.decoder = ort.InferenceSession( decoder_path, providers=['CUDAExecutionProvider', 'CPUExecutionProvider'] )
        pass

    def preprocess_image( self, img ):
        '''Preprocess image for the encoder and decoder'''

        # Resize image preserving aspect ratio using 1024 as a long side
        orig_width, orig_height = img.size
        resized_width, resized_height = img.size

        if orig_width > orig_height:
            resized_width = 1024
            resized_height = int(1024 / orig_width * orig_height)
        else:
            resized_height = 1024
            resized_width = int(1024 / orig_height * orig_width)

        img = img.resize((resized_width, resized_height), Image.Resampling.BILINEAR)

        # Prepare input tensor from image
        input_tensor = np.array(img)

        # Normalize input tensor numbers
        mean = np.array([123.675, 116.28, 103.53])
        std = np.array([[58.395, 57.12, 57.375]])
        input_tensor = (input_tensor - mean) / std

        # Transpose input tensor to shape (Batch,Channels,Height,Width
        input_tensor = input_tensor.transpose(2,0,1)[None,:,:,:].astype(np.float32)

        # Make image square 1024x1024 by padding short side by zeros
        if resized_height < resized_width:
            input_tensor = np.pad(input_tensor,((0,0),(0,0),(0,1024-resized_height),(0,0)))
        else:
            input_tensor = np.pad(input_tensor,((0,0),(0,0),(0,0),(0,1024-resized_width)))

        # Input inference coordinates are center of image
        # [x,y]
        input_coords = np.array([[ orig_width // 2, orig_height // 2]])

        # Use annotations from test image if there is an annotation

        input_label = np.array([1])
        # Add a batch index, concatenate a padding point, and transform.

        onnx_coord = np.concatenate([input_coords, np.array([[0.0, 0.0]])], axis=0)[None, :, :]
        onnx_label = np.concatenate([input_label, np.array([-1])], axis=0)[None, :].astype(np.float32)

        coords = deepcopy(onnx_coord).astype(float)
        coords[..., 0] = coords[..., 0] * (resized_width / orig_width)
        coords[..., 1] = coords[..., 1] * (resized_height / orig_height)

        onnx_coord = coords.astype("float32")
        onnx_mask_input = np.zeros((1, 1, 256, 256), dtype=np.float32)
        onnx_has_mask_input = np.zeros(1, dtype=np.float32)
        # We set the image embeddings parameter later
        return input_tensor, {
            "image_embeddings": None,
            "point_coords": onnx_coord,
            "point_labels": onnx_label,
            "mask_input": onnx_mask_input,
            "has_mask_input": onnx_has_mask_input,
            "orig_im_size": np.array([orig_height, orig_width], dtype=np.float32)
        }

    def pred( self, input_tensor, decoder_params ):
        # Get image embeddings using custom msam encoder
        outputs = self.encoder.run( None, {"images": input_tensor} )
        embeddings = outputs[0]
        decoder_params["image_embeddings"] = embeddings

        # Decode mask from image embeddings using single point as input prompt
        return self.decoder.run( None, decoder_params )

def main():
    args = parse_option()
    # load_dotenv(dotenv_path="../cs453-project/.env")
    # Get environment variables to access S3
    load_dotenv()
    ACCESS_KEY = os.getenv( 'ACCESS_KEY' )
    SECRET_KEY = os.getenv( 'SECRET_KEY' )
    BUCKET_NAME = os.getenv( 'BUCKET_NAME' )

    # Load onnx encoder and decoder
    model = CustomMSAM( encoder_path = args.custom_encoder, decoder_path = args.custom_decoder )

    # Establish S3 client
    s3_client = boto3.client(
        's3',
        aws_access_key_id = ACCESS_KEY,
        aws_secret_access_key = SECRET_KEY,
    )
    # Query the image object
    s3_response = s3_client.get_object( Bucket = BUCKET_NAME, Key = args.key)
    # Read response content
    img_b64 = s3_response["Body"].read()
    binary_data = base64.b64decode( img_b64 )
    # Wrap the binary data in BytesIO object
    image_stream = BytesIO( binary_data )

    img = Image.open(image_stream).convert("RGB")
    input_tensor, decoder_params = model.preprocess_image( img )

    # Segment the image, get output mask for overlay
    masks, pred_iou, embedding = model.pred( input_tensor, decoder_params )

    # Get a heatmap of the mask
    mask = masks[0][0]
    # # Make the mask binary
    mask = ( mask > 0 ).astype( 'uint8' )*255
    # Visualize Mask
    img_np_arr = np.array( img )
    # Convert RGB -> BGR for cv2
    img_np_arr = img_np_arr[:, :, ::-1]
    # Shape mask to fit original image dimensions
    mask = cv2.resize( mask, ( img_np_arr.shape[1], img_np_arr.shape[0] ) )
    # Color the mask blue
    colored_mask = np.zeros_like( img_np_arr )
    colored_mask[ mask == 255 ] = ( 255, 0, 0 )
    # Merge mask and original image together
    overlay = cv2.addWeighted( img_np_arr, 1.0, colored_mask, 0.5, 0 )

    # Display image for debugging
    # cv2.imshow('j',overlay)
    # cv2.waitKey(10000)

    # Convert the image to a base64 string
    _, img_enc = cv2.imencode( '.png', overlay )
    # Change image to base64 string
    image_base64 = base64.b64encode( img_enc ).decode( 'utf-8' )
    # Convert the image data to JSON
    image_json = json.dumps( { 'data': image_base64 } )
    # Print json out to stdout for server to read in from child process
    print( image_json )

if __name__ == "__main__":
    main()















