import java.awt.*;
import java.awt.image.BufferedImage;

public class Eyedropper {

    public Eyedropper(){
    }

    public Color activateEyeDropper(int x, int y, BufferedImage canvas) {
        int rgbValues = canvas.getRGB(x, y); //Outputs a right mess of numbers organised like this |RRRRRRRR|GGGGGGGG|BBBBBBBB|
        int blue = rgbValues & 0xff; //So to get rgb values of 0-255 we do some bitwise operations
        int green = (rgbValues & 0xff00) >> 8;
        int red = (rgbValues & 0xff0000) >> 16;
        Color color = new Color(red, green, blue); //Create a color with those rgb values
        return color; //return it
    }
}

/*
Eyedropper is not possible with Graphics 2D
We can use BufferedImage to display the image theat Graphics 2D creates.
And then we have the utility of both BufferedImage and Graphics2D.
Buffered image's getRGB() could be used to implement an eyedropper
 */