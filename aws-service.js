import {
  availableAttachmentType,
  DOCX_FORMAT,
  IMAGE_FORMAT,
  PDF_FORMAT,
  VIDEO_FORMAT,
  BLOB_SIZE
} from './constants';
// import * as AWS from "@aws-sdk/client-s3";
import {S3Client, GetObjectCommand,} from "@aws-sdk/client-s3";
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from "@aws-sdk/lib-storage";
import moment from 'moment';


export class AwsService {
  //client;
  /**
   * @param config
   * @description
   * - config.accessKeyId = AWS access key
   * - config.secretAccessKey = AWS secret access key
   */
  constructor(config) {
    this.cache = {};
    this.client = null;
    this.config = config;
    this.s3Configuration = ''
  }

  /**
   * @param {*} bucket Bucket name
   * @param {*} region Region name
   * @returns Bucket instance
   */


  getBucket(bucket, region) {
    this.s3Configuration = {
        credentials: {
            accessKeyId: this.config.accessKeyId,
            secretAccessKey: this.config.secretAccessKey
        },
        region: region,
    };
    let clients = new S3Client(this.s3Configuration);
    let cmd = new GetObjectCommand({Bucket: bucket});
    let data = ''
    async function asyncCall (){
      try {
        data = await clients.send(cmd);
        // process data.
      } catch (error) {
        // error handling.
      }
    }
    asyncCall();
    return data;
  }

  /**
   * @param {*} Key - File Path
   * @param {*} input - Uploaded
   * @param {*} bucket - Bucket instance
   * @param {*} bucketName - Bucket Name
   * @param {*} onProgress - Progress callback function
   */
  async uploadFile(Key,input, bucket, bucketName, onProgress) {
      return await new Promise((resolve, reject) => {
        try {
          const parallelUploads3 = new Upload({
            client: new S3Client(this.s3Configuration),
            params: { Bucket:bucketName, Key:Key, Body:input },
        
            tags: [
              /*...*/
            ], // optional tags
            queueSize: 4, // optional concurrency configuration
            partSize: 1024 * 1024 * 5, // optional size of each part, in bytes, at least 5MB
            leavePartsOnError: false, // optional manually handle dropped parts
          });
        
          parallelUploads3.on("httpUploadProgress", (progress) => {
            console.log(progress);
          });
        
           parallelUploads3.done().then(res =>{
            console.log('Uploads3 ---->', res)
            resolve()
           }
           
           );
        } catch (e) {
          console.log(e);
          reject(e);
        }
        
      });
  }

  /**
   * 
   * @param {*} file 
   * @param {*} mediaMetaData 
   * @returns files format
   */
  static getFileFormat(file, mediaMetaData) {
    let filextension = "";
    if (file) {
      filextension = `.${file.name.split(".").pop()}`.toLowerCase();
    } else if (Object.keys(mediaMetaData ||{}).length) {
      filextension = `.${mediaMetaData.type.split("/").pop()}`.toLowerCase();
    }
    if (IMAGE_FORMAT.includes(filextension)) {
      return availableAttachmentType.IMAGE;
    }
    if (PDF_FORMAT.includes(filextension)) {
      return availableAttachmentType.PDF;
    }
    if (VIDEO_FORMAT.includes(filextension)) {
      return availableAttachmentType.VIDEO;
    }
    if (DOCX_FORMAT.includes(filextension)) {
      return availableAttachmentType.DOC;
    }
    return availableAttachmentType.IMAGE;
  }

  /**
   * @param {*} bucket 
   * @param {*} bucketName 
   * @param {*} Key 
   * @param {*} Expires 
   * @returns 
   */
  async getPresignedUrl (
    bucket,
    bucketName,
    Key,
    Expires = 60 * 60
  ) {
    if (this.cache[Key] && !this.isPresignedUrlExpired(this.cache[Key].time)) {
      return this.cache[Key].url;
    }
    const s3 = new S3Client(this.s3Configuration);
    const command = new GetObjectCommand({Bucket: bucketName, Key: Key });
    const url = await getSignedUrl(s3, command, { expiresIn: Expires }); // expires in seconds
    this.cache[Key] = {
      url,
      time: moment().add(Expires, "seconds").subtract(10, "seconds"),
    };
    return url;
  }

  isPresignedUrlExpired(expiredIn){
    const current = moment();
  
    if (current.isAfter(expiredIn, "seconds")) {
      return true;
    }
  
    return false;
  }
}
