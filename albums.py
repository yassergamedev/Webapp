import os

# path to your top-level "Albums" directory
root_dir = r"C:\Users\User\Desktop\jukeboxshare\Jukebox songs"  # <-- change this to where your albums are
output_file = r"C:\Users\User\Desktop\jukeboxshare\Jukebox songs\albums_list.txt"  # where to save the text file

with open(output_file, "w", encoding="utf-8") as f:
    for album_name in os.listdir(root_dir):
        album_path = os.path.join(root_dir, album_name)
        if os.path.isdir(album_path):  # only folders
            f.write(f"Album: {album_name}\n")
            for song_name in os.listdir(album_path):
                song_path = os.path.join(album_path, song_name)
                if os.path.isfile(song_path):
                    f.write(f"    {song_name}\n")
            f.write("\n")

print(f"Album list saved to {output_file}")
