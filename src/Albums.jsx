import React, { useState, useEffect } from 'react';
import AWS from 'aws-sdk';

const albumBucketName = "test-save-point-2023-10";
const bucketRegion = "ap-northeast-1";
const IdentityPoolId = "ap-northeast-1:78502c7c-a3b4-429c-a25b-583841d47732";

AWS.config.update({
  region: bucketRegion,
  credentials: new AWS.CognitoIdentityCredentials({
    IdentityPoolId: IdentityPoolId
  })
});

const s3 = new AWS.S3({
  apiVersion: "2006-03-01",
  params: { Bucket: albumBucketName }
});

function AlbumApp() {
  const [albums, setAlbums] = useState([]);
  const [currentAlbum, setCurrentAlbum] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [photoUpload, setPhotoUpload] = useState(null);

  useEffect(() => {
    listAlbums();
  }, []);

  useEffect(() => {
    if (currentAlbum) {
      viewAlbum(currentAlbum);
    }
  }, [currentAlbum]);

  function listAlbums() {
    s3.listObjects({ Delimiter: "/" }, function(err, data) {
      if (err) {
        alert("There was an error listing your albums: " + err.message);
      } else {
        const albums = data.CommonPrefixes.map(commonPrefix => {
          const prefix = commonPrefix.Prefix;
          const albumName = decodeURIComponent(prefix.replace("/", ""));
          return albumName;
        });
        setAlbums(albums);
      }
    });
  }

  function createAlbum(albumName) {
    albumName = albumName.trim();
    if (!albumName) {
      alert("Album names must contain at least one non-space character.");
      return;
    }
    if (albumName.indexOf("/") !== -1) {
      alert("Album names cannot contain slashes.");
      return;
    }
    const albumKey = encodeURIComponent(albumName) + '/';
    s3.headObject({ Key: albumKey }, function(err, data) {
      if (!err) {
        alert("Album already exists.");
        return;
      }
      if (err.code !== "NotFound") {
        alert("There was an error creating your album: " + err.message);
        return;
      }
      s3.putObject({ Key: albumKey }, function(err, data) {
        if (err) {
          alert("There was an error creating your album: " + err.message);
          return;
        }
        alert("Successfully created album.");
        listAlbums();
        setCurrentAlbum(albumName);
      });
    });
  }

  function viewAlbum(albumName) {
    const albumPhotosKey = encodeURIComponent(albumName) + '/';
    s3.listObjects({ Prefix: albumPhotosKey }, function(err, data) {
      if (err) {
        alert("There was an error viewing your album: " + err.message);
        return;
      }
      const href = this.request.httpRequest.endpoint.href;
      const bucketUrl = href + albumBucketName + "/";
      const photos = data.Contents.map(photo => {
        const photoKey = photo.Key;
        const photoUrl = bucketUrl + encodeURIComponent(photoKey);
        return { name: photoKey.replace(albumPhotosKey, ""), url: photoUrl };
      });
      setPhotos(photos);
    });
  }

  function addPhoto(albumName, file) {
    if (!file) {
      alert("Please choose a file to upload first.");
      return;
    }
    const fileName = file.name;
    const albumPhotosKey = encodeURIComponent(albumName) + '/';
    const photoKey = albumPhotosKey + fileName;
    const upload = new AWS.S3.ManagedUpload({
      params: {
        Bucket: albumBucketName,
        Key: photoKey,
        Body: file
      }
    });

    upload.promise().then(
      function(data) {
        alert("Successfully uploaded photo.");
        viewAlbum(albumName);
      },
      function(err) {
        alert("There was an error uploading your photo: ", err.message);
      }
    );
  }

  function deleteAlbum(albumName) {
    const albumKey = encodeURIComponent(albumName) + '/';
    s3.listObjects({ Prefix: albumKey }, function(err, data) {
      if (err) {
        alert("There was an error deleting your album: ", err.message);
        return;
      }
      const objects = data.Contents.map(object => ({ Key: object.Key }));
      s3.deleteObjects({ Delete: { Objects: objects, Quiet: true } }, function(err, data) {
        if (err) {
          alert("There was an error deleting your album: ", err.message);
          return;
        }
        alert("Successfully deleted album.");
        setCurrentAlbum(null);
        listAlbums();
      });
    });
  }

  function deletePhoto(albumName, photoKey) {
    s3.deleteObject({ Key: photoKey }, function(err, data) {
      if (err) {
        alert("There was an error deleting your photo: ", err.message);
        return;
      }
      alert("Successfully deleted photo.");
      viewAlbum(albumName);
    });
  }

  return (
    <div>
      <h2>Albums</h2>
      {albums.length > 0 ? (
        <ul>
          {albums.map(album => (
            <li key={album}>
              <button onClick={() => deleteAlbum(album)}>X</button>
              <button onClick={() => setCurrentAlbum(album)}>{album}</button>
            </li>
          ))}
        </ul>
      ) : (
        <p>You do not have any albums. Please Create album.</p>
      )}
      <button onClick={() => createAlbum(prompt('Enter Album Name:'))}>Create New Album</button>
      
      {currentAlbum && (
        <div>
          <h3>Album: {currentAlbum}</h3>
          {photos.length > 0 ? (
            <div>
              {photos.map(photo => (
                <div key={photo.name}>
                  <button onClick={() => deletePhoto(currentAlbum, photo.name)}>X</button>
                  <img src={photo.url} alt={photo.name} style={{ width: '100px', height: '100px' }} />
                  <p>{photo.name}</p>
                </div>
              ))}
            </div>
          ) : (
            <p>This album is empty.</p>
          )}
          <input type="file" onChange={e => setPhotoUpload(e.target.files[0])} />
          {photoUpload && (
            <button onClick={() => addPhoto(currentAlbum, photoUpload)}>Upload Photo</button>
          )}
          <button onClick={() => setCurrentAlbum(null)}>Back to Albums</button>
        </div>
      )}
    </div>
  );
}

export default AlbumApp;
