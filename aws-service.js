import {
  availableAttachmentType,
  DOCX_FORMAT,
  IMAGE_FORMAT,
  PDF_FORMAT,
  VIDEO_FORMAT,
  BLOB_SIZE
} from './constants';
import AWS from 'aws-sdk';

export class AwsService {
  //client;
  /**
   * @param config
   * @description
   * - config.accessKeyId = AWS access key
   * - config.secretAccessKey = AWS secret access key
   */
  constructor(config) {
    AWS.config.update(config);
  }

  /**
   * @param {*} bucket Bucket name
   * @param {*} region Region name
   * @returns Bucket instance
   */
  getBucket(bucket, region) {
    return new AWS.S3({
      params: { Bucket: bucket },
      region,
    });
  }

  /**
   * @param {*} Key - File Path
   * @param {*} input - Uploaded
   * @param {*} bucket - Bucket instance
   * @param {*} bucketName - Bucket Name
   * @param {*} onProgress - Progress callback function
   */
  async uploadFile(Key,input, bucket, bucketName, onProgress) {
    if (input.size < BLOB_SIZE) {
      return await new Promise((resolve, reject) => {
        bucket
          .upload({
            Body: input,
            Bucket: bucketName,
            Key,
          })
          .on('httpUploadProgress', (e) => {
            onProgress(((e.loaded / e.total) * 100).toFixed(2));
          })
          .send((err, data) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(data.Location);
          });
      });
    }

    const parts = this.getFileSlices(input);
    const uploadId = await new Promise((resolve, reject) => {
      bucket.createMultipartUpload({ Key, Bucket: bucketName }, (err, data) => {
        resolve(data.UploadId);
      });
    });

    const multipartMap = { Parts: [] };
    let loaded = 0;
    for (var part of parts) {
      let partsLoaded = 0;
      const { ETag } = await new Promise((resolve, reject) => {
        bucket
          .uploadPart(
            {
              Bucket: bucketName,
              Key,
              PartNumber: part.id,
              UploadId: uploadId,
              Body: part.blob,
            },
            (err, data) => {
              if (err) {
                reject(err);
                return;
              }
              resolve(data);
            }
          )
          .on('httpUploadProgress', (e) => {
            partsLoaded = e.loaded;
            onProgress(
              (((loaded + partsLoaded) / input.size) * 100).toFixed(2)
            );
          });
      });
      loaded += part.blob.size;
      onProgress(((loaded / input.size) * 100).toFixed(2));

      multipartMap.Parts[part.id] = {
        ETag,
        PartNumber: part.id,
      };
    }

    return await new Promise((resolve, reject) => {
      bucket.completeMultipartUpload(
        {
          Key,
          Bucket: bucketName,
          UploadId: uploadId,
          MultipartUpload: multipartMap,
        },
        (err, data) => {
          if (err) {
            reject(err);
            return;
          }
          onProgress(100);
          resolve(data.Location);
        }
      );
    });
  }

  /**
   * 
   * @param {*} file 
   * @returns Slices of files for chunk uploading
   */
  getFileSlices(file) {
    const fileSize = file.size;
    const blobSize = BLOB_SIZE;
    const parts = [];

    const numberOfParts = Math.ceil(fileSize / blobSize);
    for (var i = 0; i < numberOfParts; i++) {
      parts.push({
        blob: file.slice(i * blobSize, i * blobSize + blobSize),
        id: i + 1,
      });
    }

    return parts;
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
}
