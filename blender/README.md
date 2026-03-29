## Creating the model

(The pieces were created using this Polygon Runway [tutorial](https://www.youtube.com/watch?v=Iu8jV7g9Oqk) ...)

The model needs to follow these rules:
* Board is centered on world origin
* Right: +X, front: -Y, up: +Z
* Square size is 1 blender unit (1 meter)
* If the board has some thickness, Z location of the top must be 0
* Local origin of the pieces is the center of their base. This allows to place them on the board.


## Exporting the model to .glb

* Transform +Y Up
* Apply modifiers